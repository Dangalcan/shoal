/**
 * Plugin Extensions
 *
 * Persistent registry for plugin UI extensions (sidebar items, pages, resource
 * actions) backed by SQLite via StorageService. Uses a reserved storage key
 * scoped to each plugin.
 */

import type { PluginExtensions } from '../../types/plugin-types';
import { storageService } from './storage-service';

const EXTENSIONS_STORAGE_KEY = '__extensions__';

export function getPluginExtensions(pluginId: string): PluginExtensions {
  return (
    (storageService.get(
      pluginId,
      EXTENSIONS_STORAGE_KEY
    ) as PluginExtensions) || {}
  );
}

export function savePluginExtensions(
  pluginId: string,
  extensions: PluginExtensions
): void {
  storageService.set(pluginId, EXTENSIONS_STORAGE_KEY, extensions);
}

export function clearPluginExtensions(pluginId: string): void {
  storageService.delete(pluginId, EXTENSIONS_STORAGE_KEY);
}

export function getAllPluginExtensions(): Map<string, PluginExtensions> {
  return storageService.getAllByKey(EXTENSIONS_STORAGE_KEY) as Map<
    string,
    PluginExtensions
  >;
}
