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
   * Get the directory where bundled plugins are located. Packaged builds ship
   * them as extraResources (outside app.asar); dev runs read them from the repo.
   */
  getBundledPluginsDir(): string {
    return app.isPackaged
      ? path.join(process.resourcesPath, 'plugins')
      : path.join(app.getAppPath(), 'plugins');
  }

  /**
   * The app's built renderer (index.html, assets/, plugin-host/). Plugin
   * frames load the sandbox host document and the app stylesheets from here
   * through the plugin-file: protocol.
   */
  getAppDistDir(): string {
    return path.join(app.getAppPath(), 'dist');
  }

  /**
   * Get all plugin discovery directories. Bundled plugins come first: their
   * ids are reserved, so a user-installed copy can never shadow one.
   */
  getDiscoveryDirectories(): string[] {
    return [this.getBundledPluginsDir(), this.getUserPluginsDir()];
  }

  /** True when `pluginId` belongs to a plugin bundled with the app. */
  async isBundledPluginId(pluginId: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.getBundledPluginsDir(), pluginId));
      return true;
    } catch {
      return false;
    }
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
   * Resolve the full path to an installed plugin (bundled directory first).
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
