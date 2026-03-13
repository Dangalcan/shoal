/**
 * Path Service
 *
 * Centralized service for managing all plugin-related filesystem paths.
 * ensures consistency between bundled and user-installed plugins.
 */

import path from 'path';
import { app } from 'electron';
import fs from 'fs/promises';

export class PathService {
  /**
   * Get the directory where user plugins are installed
   */
  getUserPluginsDir(): string {
    return path.join(app.getPath('userData'), 'plugins');
  }

  /**
   * Get the directory where bundled plugins are located
   */
  getBundledPluginsDir(): string {
    return path.join(app.getAppPath(), 'plugins');
  }

  /**
   * Get all plugin discovery directories
   */
  getDiscoveryDirectories(): string[] {
    return [this.getUserPluginsDir(), this.getBundledPluginsDir()];
  }

  /**
   * Get the storage directory for a specific plugin
   */
  getPluginStorageDir(pluginId: string): string {
    return path.join(app.getPath('userData'), 'plugin-storage', pluginId);
  }

  /**
   * Get the path to the plugin-specific SQLite database
   */
  getPluginDatabasePath(pluginId: string): string {
    return path.join(this.getPluginStorageDir(pluginId), 'storage.db');
  }

  /**
   * Get the log directory for a plugin
   */
  getPluginLogDir(pluginId: string): string {
    return path.join(app.getPath('userData'), 'logs', 'plugins', pluginId);
  }

  /**
   * Get the cache directory for a plugin
   */
  getPluginCacheDir(pluginId: string): string {
    return path.join(app.getPath('userData'), 'cache', 'plugins', pluginId);
  }

  /**
   * Ensure a directory exists
   */
  async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error: unknown) {
      if (
        !(error instanceof Error) ||
        (error as NodeJS.ErrnoException).code !== 'EEXIST'
      ) {
        throw error;
      }
    }
  }

  /**
   * Resolve the full path to an installed plugin
   */
  async resolvePluginPath(pluginId: string): Promise<string | null> {
    for (const dir of this.getDiscoveryDirectories()) {
      const fullPath = path.join(dir, pluginId);
      try {
        await fs.access(fullPath);
        return fullPath;
      } catch {
        continue;
      }
    }
    return null;
  }
}

export const pathService = new PathService();
