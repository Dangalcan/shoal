/**
 * Plugin Context
 *
 * Creates isolated context for each plugin with controlled API access.
 * Provides kubernetes, UI, storage, logging, and event APIs to plugins.
 */

import type {
  PluginContext,
  KubernetesAPI,
  UIAPI,
  StorageAPI,
  LoggerAPI,
  EventsAPI,
  SidebarExtension,
  ResourceActionExtension,
  PageExtension,
} from '../../types/plugin-types';

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { pluginEventBus } from './plugin-events';
import { storageService } from './storage-service';
import { kubernetesService } from '../kubernetes/kubernetes-service';

/**
 * Create a plugin context with controlled API access
 */
export function createPluginContext(
  pluginId: string,
  pluginPath: string,
  permissions: string[]
): PluginContext {
  // Create Kubernetes API (if permission granted)
  const kubernetes: KubernetesAPI = permissions.includes('kubernetes')
    ? {
        getResources: async (type: string, namespace: string) => {
          try {
            return await kubernetesService.getResources(type, namespace);
          } catch (error: any) {
            throw new Error(`Failed to get resources: ${error.message}`);
          }
        },

        createResource: async (manifest: any) => {
          try {
            return await kubernetesService.createResource(manifest);
          } catch (error: any) {
            throw new Error(`Failed to create resource: ${error.message}`);
          }
        },

        updateResource: async (type: string, name: string, manifest: any) => {
          try {
            return await kubernetesService.updateResource(type, name, manifest);
          } catch (error: any) {
            throw new Error(`Failed to update resource: ${error.message}`);
          }
        },

        deleteResource: async (
          type: string,
          name: string,
          namespace: string
        ) => {
          try {
            return await kubernetesService.deleteResource(
              type,
              name,
              namespace
            );
          } catch (error: any) {
            throw new Error(`Failed to delete resource: ${error.message}`);
          }
        },

        executeCommand: async (
          pod: string,
          namespace: string,
          command: string
        ) => {
          try {
            return await kubernetesService.executeCommand(
              pod,
              namespace,
              command
            );
          } catch (error: any) {
            throw new Error(`Failed to execute command: ${error.message}`);
          }
        },

        watchResources: (type: string, callback: (event: any) => void) => {
          if (!permissions.includes('kubernetes')) {
            throw new Error('Permission denied: kubernetes');
          }

          // Validate resource type to prevent command injection
          if (!/^[a-zA-Z0-9.\-/]+$/.test(type)) {
            throw new Error(`Invalid resource type: "${type}"`);
          }

          console.log(`[PluginContext] ${pluginId} started watching ${type}`);

          const watchProcess = spawn('kubectl', [
            'get',
            type,
            '--watch',
            '-o',
            'json',
          ]);

          let buffer = '';

          watchProcess.stdout.on('data', (data: Buffer) => {
            buffer += data.toString();

            // Kubectl outputs one full JSON object at a time for each event.
            // We can try to parse the buffer. If it fails, we wait for more data.
            // A simple way is to find the balance of braces.
            let braceCount = 0;
            let startIndex = -1;

            for (let i = 0; i < buffer.length; i++) {
              if (buffer[i] === '{') {
                if (braceCount === 0) startIndex = i;
                braceCount++;
              } else if (buffer[i] === '}') {
                braceCount--;
                if (braceCount === 0 && startIndex !== -1) {
                  const jsonStr = buffer.substring(startIndex, i + 1);
                  try {
                    const event = JSON.parse(jsonStr);
                    callback(event);
                  } catch (e) {
                    console.error(
                      `[PluginContext] Failed to parse watch event for ${pluginId}:`,
                      e
                    );
                  }
                  // Move buffer forward
                  buffer = buffer.substring(i + 1);
                  i = -1; // Reset loop
                }
              }
            }
          });

          watchProcess.stderr.on('data', (data: Buffer) => {
            console.error(
              `[PluginContext] Watch error for ${pluginId} (${type}):`,
              data.toString()
            );
          });

          // Return cleanup function
          return () => {
            console.log(`[PluginContext] ${pluginId} stopped watching ${type}`);
            watchProcess.kill();
          };
        },
      }
    : (createDeniedAPI('kubernetes') as KubernetesAPI);

  // Create UI API (if permission granted)
  const ui: UIAPI = permissions.includes('ui')
    ? {
        registerSidebarItem: (item: SidebarExtension) => {
          // Store extension registration for retrieval by renderer
          const extensions = getPluginExtensions(pluginId);
          if (!extensions.sidebar) {
            extensions.sidebar = [];
          }

          // Update existing or add new
          const existingIndex = extensions.sidebar.findIndex(
            (i: SidebarExtension) => i.id === item.id
          );
          if (existingIndex >= 0) {
            extensions.sidebar[existingIndex] = item;
          } else {
            extensions.sidebar.push(item);
          }

          savePluginExtensions(pluginId, extensions);
          console.log(
            `[PluginContext] Registered/Updated sidebar item for ${pluginId}:`,
            item.label
          );
        },

        registerPage: (route: string, component: any) => {
          const extensions = getPluginExtensions(pluginId);
          if (!extensions.pages) {
            extensions.pages = [];
          }

          // `component` must be a string — either a renderer-relative module path
          // (e.g. "./pages/MyPage") or a named export identifier.  Passing an
          // actual function here is a mistake: main-process code cannot be
          // serialised and sent to the renderer.
          if (typeof component !== 'string') {
            throw new Error(
              `[PluginContext] registerPage: "component" must be a string ` +
                `(renderer module path or export name), not ${typeof component}. ` +
                `UI components must live in the plugin's renderer entry file.`
            );
          }

          const pageId = `${pluginId}-page`;
          const existingIndex = extensions.pages.findIndex(
            (p: PageExtension) => p.id === pageId
          );

          const newPage: PageExtension = {
            id: pageId,
            route,
            component,
          };

          if (existingIndex >= 0) {
            extensions.pages[existingIndex] = newPage;
          } else {
            extensions.pages.push(newPage);
          }

          savePluginExtensions(pluginId, extensions);
          console.log(
            `[PluginContext] Registered/Updated page for ${pluginId}:`,
            route
          );
        },

        registerResourceAction: (
          resourceType: string,
          action: ResourceActionExtension
        ) => {
          const extensions = getPluginExtensions(pluginId);
          if (!extensions.resourceActions) {
            extensions.resourceActions = [];
          }

          // Add resource type to action
          const fullAction = {
            ...action,
            resourceTypes: [resourceType],
          };

          const existingIndex = extensions.resourceActions.findIndex(
            (a: ResourceActionExtension) => a.id === action.id
          );

          if (existingIndex >= 0) {
            extensions.resourceActions[existingIndex] = fullAction;
          } else {
            extensions.resourceActions.push(fullAction);
          }

          savePluginExtensions(pluginId, extensions);
          console.log(
            `[PluginContext] Registered/Updated resource action for ${pluginId}:`,
            action.label
          );
        },

        showNotification: (
          message: string,
          type: 'success' | 'error' | 'info' | 'warning'
        ) => {
          const win = pluginEventBus.getMainWindow();
          if (win) {
            win.webContents.send('plugin-notification', {
              pluginId,
              message,
              type,
            });
          }
          console.log(
            `[PluginContext] Notification sent from ${pluginId}:`,
            type,
            message
          );
        },

        openModal: (component: string, props?: any) => {
          if (typeof component !== 'string') {
            throw new Error(
              `[PluginContext] openModal: "component" must be a string (modal ID registered via pluginUIRegistry.registerModal), not ${typeof component}.`
            );
          }
          const win = pluginEventBus.getMainWindow();
          if (win) {
            win.webContents.send('plugin-modal', {
              pluginId,
              component,
              props,
            });
          }
          console.log(`[PluginContext] Open modal from ${pluginId}`);
        },
      }
    : (createDeniedAPI('ui') as UIAPI);

  // Create Storage API (if permission granted)
  const storage: StorageAPI = permissions.includes('storage')
    ? {
        get: async <T = any>(key: string): Promise<T | null> => {
          return storageService.get(pluginId, key);
        },

        set: async <T = any>(key: string, value: T): Promise<void> => {
          try {
            storageService.set(pluginId, key, value);
          } catch (e) {
            throw new Error(
              `Failed to save data: ${e instanceof Error ? e.message : String(e)}`
            );
          }
        },

        delete: async (key: string): Promise<void> => {
          try {
            storageService.delete(pluginId, key);
          } catch (e) {
            throw new Error(
              `Failed to delete data: ${e instanceof Error ? e.message : String(e)}`
            );
          }
        },

        clear: async (): Promise<void> => {
          try {
            storageService.clear(pluginId);
          } catch (e) {
            throw new Error(
              `Failed to clear storage: ${e instanceof Error ? e.message : String(e)}`
            );
          }
        },
      }
    : (createDeniedAPI('storage') as StorageAPI);

  // Create Logger API (always available)
  const logger: LoggerAPI = {
    info: (message: string, ...args: any[]) => {
      console.log(`[Plugin:${pluginId}] INFO:`, message, ...args);
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(`[Plugin:${pluginId}] WARN:`, message, ...args);
    },
    error: (message: string, ...args: any[]) => {
      console.error(`[Plugin:${pluginId}] ERROR:`, message, ...args);
    },
    debug: (message: string, ...args: any[]) => {
      console.debug(`[Plugin:${pluginId}] DEBUG:`, message, ...args);
    },
  };

  // Create Events API (always available)
  const emitter = new EventEmitter();
  const events: EventsAPI = {
    // Subscribe to events
    on: (event: string, handler: (...args: any[]) => void) => {
      emitter.on(event, handler);
      console.log(`[PluginContext] ${pluginId} subscribed to event: ${event}`);
    },
    once: (event: string, handler: (...args: any[]) => void) => {
      emitter.once(event, handler);
      console.log(
        `[PluginContext] ${pluginId} subscribed once to event: ${event}`
      );
    },
    off: (event: string, handler: (...args: any[]) => void) => {
      emitter.off(event, handler);
      console.log(
        `[PluginContext] ${pluginId} unsubscribed from event: ${event}`
      );
    },

    // Emit events
    emit: (event: string, ...args: any[]) => {
      emitter.emit(event, ...args);
      console.log(`[PluginContext] ${pluginId} emitted event: ${event}`);
    },

    // Cross-plugin communication
    broadcast: (event: string, ...args: any[]) => {
      pluginEventBus.emit(`plugin-broadcast:${event}`, {
        sender: pluginId,
        payload: args,
      });
      console.log(`[PluginContext] ${pluginId} broadcasted event: ${event}`);
    },
    onBroadcast: (event: string, handler: (...args: any[]) => void) => {
      pluginEventBus.on(`plugin-broadcast:${event}`, handler);
      console.log(
        `[PluginContext] ${pluginId} listening to broadcast: ${event}`
      );
    },
    offBroadcast: (event: string, handler: (...args: any[]) => void) => {
      pluginEventBus.off(`plugin-broadcast:${event}`, handler);
      console.log(
        `[PluginContext] ${pluginId} stopped listening to broadcast: ${event}`
      );
    },

    // App lifecycle hooks
    onClusterConnected: (handler: (cluster: any) => void) => {
      pluginEventBus.on('cluster:connected', handler);
      console.log(
        `[PluginContext] ${pluginId} subscribed to cluster:connected`
      );
    },
    onClusterDisconnected: (handler: (cluster: any) => void) => {
      pluginEventBus.on('cluster:disconnected', handler);
      console.log(
        `[PluginContext] ${pluginId} subscribed to cluster:disconnected`
      );
    },
    onResourceCreated: (handler: (resource: any) => void) => {
      pluginEventBus.on('resource:created', handler);
      console.log(`[PluginContext] ${pluginId} subscribed to resource:created`);
    },
    onResourceUpdated: (handler: (resource: any) => void) => {
      pluginEventBus.on('resource:updated', handler);
      console.log(`[PluginContext] ${pluginId} subscribed to resource:updated`);
    },
    onResourceDeleted: (handler: (resource: any) => void) => {
      pluginEventBus.on('resource:deleted', handler);
      console.log(`[PluginContext] ${pluginId} subscribed to resource:deleted`);
    },
  };

  return {
    pluginId,
    pluginPath,
    kubernetes,
    ui,
    storage,
    logger,
    events,
  };
}

/**
 * Create a denied API that throws errors when accessed
 */
function createDeniedAPI(apiName: string): any {
  return new Proxy(
    {},
    {
      get: () => {
        return () => {
          throw new Error(
            `Permission denied: Plugin does not have '${apiName}' permission`
          );
        };
      },
    }
  );
}

/**
 * Persistent registry for plugin extensions backed by SQLite via StorageService.
 * Uses a reserved storage key scoped to each plugin.
 */
const EXTENSIONS_STORAGE_KEY = '__extensions__';

function getPluginExtensions(pluginId: string): any {
  return storageService.get(pluginId, EXTENSIONS_STORAGE_KEY) || {};
}

function savePluginExtensions(pluginId: string, extensions: any): void {
  storageService.set(pluginId, EXTENSIONS_STORAGE_KEY, extensions);
}

export function clearPluginExtensions(pluginId: string): void {
  storageService.delete(pluginId, EXTENSIONS_STORAGE_KEY);
}

export function getAllPluginExtensions(): Map<string, any> {
  return storageService.getAllByKey(EXTENSIONS_STORAGE_KEY);
}
