/**
 * Plugin Context
 *
 * Creates isolated context for each plugin with controlled API access.
 * Provides kubernetes, UI, storage, logging, and event APIs to plugins.
 */

import path from 'path';
import fs from 'fs/promises';
import { app } from 'electron';
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

// Import the cluster management service for Kubernetes operations
import { clusterManagementService } from '../cluster/cluster-management-service';
import { exec } from 'child_process';
import util from 'util';
import { EventEmitter } from 'events';
import { pluginEventBus } from './plugin-events';

const execPromise = util.promisify(exec);

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
          // TODO: Implement resource watching
          console.warn('[PluginContext] Resource watching not yet implemented');
          return () => {}; // Return cleanup function
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

          const pageId = `${pluginId}-page`;
          const existingIndex = extensions.pages.findIndex(
            (p: PageExtension) => p.id === pageId
          );

          const newPage = {
            id: pageId,
            route,
            component: component.toString(),
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
          const { win } = require('../../main');
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

        openModal: (component: any, props?: any) => {
          console.log(`[PluginContext] Open modal from ${pluginId}`);
          // TODO: Send to renderer
        },
      }
    : (createDeniedAPI('ui') as UIAPI);

  // Create Storage API (if permission granted)
  const storage: StorageAPI = permissions.includes('storage')
    ? {
        get: async <T = any>(key: string): Promise<T | null> => {
          try {
            const storagePath = getPluginStoragePath(pluginId);
            const filePath = path.join(storagePath, `${key}.json`);
            const data = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(data) as T;
          } catch (error) {
            return null;
          }
        },

        set: async <T = any>(key: string, value: T): Promise<void> => {
          try {
            const storagePath = getPluginStoragePath(pluginId);
            await fs.mkdir(storagePath, { recursive: true });
            const filePath = path.join(storagePath, `${key}.json`);
            await fs.writeFile(
              filePath,
              JSON.stringify(value, null, 2),
              'utf-8'
            );
          } catch (error: any) {
            throw new Error(`Failed to save data: ${error.message}`);
          }
        },

        delete: async (key: string): Promise<void> => {
          try {
            const storagePath = getPluginStoragePath(pluginId);
            const filePath = path.join(storagePath, `${key}.json`);
            await fs.unlink(filePath);
          } catch (error: any) {
            // Ignore if file doesn't exist
            if (error.code !== 'ENOENT') {
              throw new Error(`Failed to delete data: ${error.message}`);
            }
          }
        },

        clear: async (): Promise<void> => {
          try {
            const storagePath = getPluginStoragePath(pluginId);
            const files = await fs.readdir(storagePath);
            for (const file of files) {
              await fs.unlink(path.join(storagePath, file));
            }
          } catch (error: any) {
            throw new Error(`Failed to clear storage: ${error.message}`);
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
 * Get plugin storage path
 */
function getPluginStoragePath(pluginId: string): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'plugin-storage', pluginId);
}

/**
 * In-memory storage for plugin extensions (temporary)
 * TODO: Move to proper registry
 */
const pluginExtensionsMap = new Map<string, any>();

function getPluginExtensions(pluginId: string): any {
  return pluginExtensionsMap.get(pluginId) || {};
}

function savePluginExtensions(pluginId: string, extensions: any): void {
  pluginExtensionsMap.set(pluginId, extensions);
}

export function clearPluginExtensions(pluginId: string): void {
  pluginExtensionsMap.delete(pluginId);
}

export function getAllPluginExtensions(): Map<string, any> {
  return pluginExtensionsMap;
}
