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
import { getPluginExtensions, savePluginExtensions } from './plugin-extensions';
import { getErrorMessage } from '../../utils/error-utils';
import { kubernetesService } from '../kubernetes/kubernetes-service';
import log from '../../logger';

async function wrapK8sCall<T>(fn: () => Promise<T>, label: string): Promise<T> {
  try {
    return await fn();
  } catch (error: unknown) {
    throw new Error(`Failed to ${label}: ${getErrorMessage(error)}`);
  }
}

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
        getResources: (type: string, namespace: string) =>
          wrapK8sCall(
            () => kubernetesService.getResources(type, namespace),
            'get resources'
          ),

        createResource: (manifest: unknown) =>
          wrapK8sCall(
            () => kubernetesService.createResource(manifest),
            'create resource'
          ),

        updateResource: (type: string, name: string, manifest: unknown) =>
          wrapK8sCall(
            () => kubernetesService.updateResource(type, name, manifest),
            'update resource'
          ),

        deleteResource: (type: string, name: string, namespace: string) =>
          wrapK8sCall(
            () => kubernetesService.deleteResource(type, name, namespace),
            'delete resource'
          ),

        executeCommand: (pod: string, namespace: string, command: string) =>
          wrapK8sCall(
            () => kubernetesService.executeCommand(pod, namespace, command),
            'execute command'
          ),

        watchResources: (type: string, callback: (event: unknown) => void) => {
          // Validate resource type to prevent command injection
          if (!/^[a-zA-Z0-9.\-/]+$/.test(type)) {
            throw new Error(`Invalid resource type: "${type}"`);
          }

          log.info(`[PluginContext] ${pluginId} started watching ${type}`);

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
                    log.error(
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
            log.error(
              `[PluginContext] Watch error for ${pluginId} (${type}):`,
              data.toString()
            );
          });

          // Return cleanup function
          return () => {
            log.info(`[PluginContext] ${pluginId} stopped watching ${type}`);
            watchProcess.kill();
          };
        },
      }
    : (createDeniedAPI('kubernetes') as KubernetesAPI);

  // Deliver a notification to the main window (shared by showNotification
  // and notifyOnce).
  const sendNotification = (
    message: string,
    type: 'success' | 'error' | 'info' | 'warning'
  ): void => {
    const win = pluginEventBus.getMainWindow();
    if (win) {
      win.webContents.send('plugin-notification', {
        pluginId,
        message,
        type,
      });
    }
    log.info(
      `[PluginContext] Notification sent from ${pluginId}:`,
      type,
      message
    );
  };

  // Per-plugin notifyOnce cooldown ledger (reset when the plugin reloads)
  const notifiedAt = new Map<string, number>();
  const DEFAULT_NOTIFY_COOLDOWN_MS = 30 * 60 * 1000;

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
          log.info(
            `[PluginContext] Registered/Updated sidebar item for ${pluginId}:`,
            item.label
          );
        },

        registerPage: (route: string, component: unknown) => {
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
          log.info(
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
          log.info(
            `[PluginContext] Registered/Updated resource action for ${pluginId}:`,
            action.label
          );
        },

        showNotification: (
          message: string,
          type: 'success' | 'error' | 'info' | 'warning'
        ) => {
          sendNotification(message, type);
        },

        notifyOnce: (
          key: string,
          message: string,
          type: 'success' | 'error' | 'info' | 'warning',
          cooldownMs: number = DEFAULT_NOTIFY_COOLDOWN_MS
        ): boolean => {
          const now = Date.now();
          const last = notifiedAt.get(key) ?? 0;
          if (now - last < cooldownMs) return false;
          notifiedAt.set(key, now);
          sendNotification(message, type);
          return true;
        },

        openModal: (component: string, props?: Record<string, unknown>) => {
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
          log.info(`[PluginContext] Open modal from ${pluginId}`);
        },
      }
    : (createDeniedAPI('ui') as UIAPI);

  // Create Storage API (if permission granted)
  const storage: StorageAPI = permissions.includes('storage')
    ? {
        get: async <T = unknown>(key: string): Promise<T | null> => {
          return storageService.get(pluginId, key) as T | null;
        },

        set: async <T = unknown>(key: string, value: T): Promise<void> => {
          try {
            storageService.set(pluginId, key, value);
          } catch (e) {
            throw new Error(`Failed to save data: ${getErrorMessage(e)}`);
          }
        },

        delete: async (key: string): Promise<void> => {
          try {
            storageService.delete(pluginId, key);
          } catch (e) {
            throw new Error(`Failed to delete data: ${getErrorMessage(e)}`);
          }
        },

        clear: async (): Promise<void> => {
          try {
            storageService.clear(pluginId);
          } catch (e) {
            throw new Error(`Failed to clear storage: ${getErrorMessage(e)}`);
          }
        },
      }
    : (createDeniedAPI('storage') as StorageAPI);

  // Create Logger API (always available)
  const logger: LoggerAPI = {
    info: (message: string, ...args: unknown[]) => {
      log.info(`[Plugin:${pluginId}] INFO:`, message, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
      log.warn(`[Plugin:${pluginId}] WARN:`, message, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
      log.error(`[Plugin:${pluginId}] ERROR:`, message, ...args);
    },
    debug: (message: string, ...args: unknown[]) => {
      log.debug(`[Plugin:${pluginId}] DEBUG:`, message, ...args);
    },
  };

  // Create Events API (always available)
  const emitter = new EventEmitter();
  const events: EventsAPI = {
    // Subscribe to events
    on: (event: string, handler: (...args: unknown[]) => void) => {
      emitter.on(event, handler);
      log.info(`[PluginContext] ${pluginId} subscribed to event: ${event}`);
    },
    once: (event: string, handler: (...args: unknown[]) => void) => {
      emitter.once(event, handler);
      log.info(
        `[PluginContext] ${pluginId} subscribed once to event: ${event}`
      );
    },
    off: (event: string, handler: (...args: unknown[]) => void) => {
      emitter.off(event, handler);
      log.info(`[PluginContext] ${pluginId} unsubscribed from event: ${event}`);
    },

    // Emit events
    emit: (event: string, ...args: unknown[]) => {
      emitter.emit(event, ...args);
      log.info(`[PluginContext] ${pluginId} emitted event: ${event}`);
    },

    // Cross-plugin communication
    broadcast: (event: string, ...args: unknown[]) => {
      pluginEventBus.emit(`plugin-broadcast:${event}`, {
        sender: pluginId,
        payload: args,
      });
      log.info(`[PluginContext] ${pluginId} broadcasted event: ${event}`);
    },
    onBroadcast: (event: string, handler: (...args: unknown[]) => void) => {
      pluginEventBus.on(`plugin-broadcast:${event}`, handler);
      log.info(`[PluginContext] ${pluginId} listening to broadcast: ${event}`);
    },
    offBroadcast: (event: string, handler: (...args: unknown[]) => void) => {
      pluginEventBus.off(`plugin-broadcast:${event}`, handler);
      log.info(
        `[PluginContext] ${pluginId} stopped listening to broadcast: ${event}`
      );
    },

    // App lifecycle hooks
    onClusterConnected: (handler: (cluster: unknown) => void) => {
      pluginEventBus.on('cluster:connected', handler);
      log.info(`[PluginContext] ${pluginId} subscribed to cluster:connected`);
    },
    onClusterDisconnected: (handler: (cluster: unknown) => void) => {
      pluginEventBus.on('cluster:disconnected', handler);
      log.info(
        `[PluginContext] ${pluginId} subscribed to cluster:disconnected`
      );
    },
    onResourceCreated: (handler: (resource: unknown) => void) => {
      pluginEventBus.on('resource:created', handler);
      log.info(`[PluginContext] ${pluginId} subscribed to resource:created`);
    },
    onResourceUpdated: (handler: (resource: unknown) => void) => {
      pluginEventBus.on('resource:updated', handler);
      log.info(`[PluginContext] ${pluginId} subscribed to resource:updated`);
    },
    onResourceDeleted: (handler: (resource: unknown) => void) => {
      pluginEventBus.on('resource:deleted', handler);
      log.info(`[PluginContext] ${pluginId} subscribed to resource:deleted`);
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
function createDeniedAPI(apiName: string): object {
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
