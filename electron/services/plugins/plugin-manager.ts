/**
 * Plugin Manager
 *
 * Orchestrates plugin loading, activation, and lifecycle management.
 * Coordinates between loader, registry, and context.
 */

import type { Plugin, PluginExtensions } from '../../types/plugin-types';
import { pluginLoader } from './plugin-loader';
import { pluginRegistry } from './plugin-registry';
import { createPluginContext, getAllPluginExtensions } from './plugin-context';
import { licenseManager } from '../security/license-manager';
import { marketplaceService } from '../marketplace/marketplace-service';
import fs from 'fs';
import path from 'path';

export class PluginManager {
  private initialized = false;
  private watchers: Map<string, fs.FSWatcher> = new Map();

  /**
   * Initialize the plugin system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[PluginManager] Already initialized');
      return;
    }

    try {
      console.log('[PluginManager] Initializing plugin system...');

      // Initialize registry
      await pluginRegistry.initialize();

      // Discover plugins
      const discoveredPlugins = await pluginLoader.discoverPlugins();
      console.log(
        `[PluginManager] Discovered ${discoveredPlugins.length} plugins`
      );

      // Register discovered plugins
      for (const plugin of discoveredPlugins) {
        pluginLoader.registerPlugin(plugin);
        await pluginRegistry.registerPlugin(plugin);
      }

      // Auto-enable plugins that were previously enabled
      const enabledPlugins = pluginRegistry.getEnabledPlugins();
      console.log(
        `[PluginManager] Auto-enabling ${enabledPlugins.length} plugins`
      );

      for (const plugin of enabledPlugins) {
        try {
          await this.activatePlugin(plugin.manifest.id);
        } catch (error: any) {
          console.error(
            `[PluginManager] Failed to auto-enable ${plugin.manifest.id}:`,
            error.message
          );
        }
      }

      this.initialized = true;
      console.log('[PluginManager] Plugin system initialized successfully');
    } catch (error: any) {
      console.error('[PluginManager] Failed to initialize:', error.message);
      throw error;
    }
  }

  /**
   * Get all plugins
   */
  getPlugins(): Plugin[] {
    return pluginRegistry.getAllPlugins();
  }

  /**
   * Get a specific plugin
   */
  getPlugin(pluginId: string): Plugin | undefined {
    const entry = pluginRegistry.getPlugin(pluginId);
    return entry?.plugin;
  }

  /**
   * Check for updates for all installed plugins
   */
  async checkForUpdates(): Promise<void> {
    const installedPlugins = this.getPlugins();
    const pluginList = installedPlugins.map((p) => ({
      id: p.manifest.id,
      version: p.manifest.version,
    }));

    const result = await marketplaceService.checkForUpdates(pluginList);

    if (result.success && result.data) {
      for (const update of result.data) {
        const plugin = this.getPlugin(update.pluginId);
        if (plugin && update.hasUpdate) {
          plugin.hasUpdate = true;
          plugin.latestVersion = update.latestVersion;
        }
      }
    }
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(pluginId: string): Promise<void> {
    console.log(`[PluginManager] Enabling plugin: ${pluginId}`);

    // Check if plugin exists
    if (!pluginRegistry.hasPlugin(pluginId)) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Enable in registry
    await pluginRegistry.enablePlugin(pluginId);

    // Activate the plugin
    await this.activatePlugin(pluginId);

    console.log(`[PluginManager] Plugin ${pluginId} enabled successfully`);
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginId: string): Promise<void> {
    console.log(`[PluginManager] Disabling plugin: ${pluginId}`);

    // Stop watcher if exists
    this.stopWatcher(pluginId);

    // Check if plugin exists
    if (!pluginRegistry.hasPlugin(pluginId)) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Deactivate the plugin
    await this.deactivatePlugin(pluginId);

    // Disable in registry
    await pluginRegistry.disablePlugin(pluginId);

    console.log(`[PluginManager] Plugin ${pluginId} disabled successfully`);
  }

  /**
   * Reload a plugin (deactivate, clear cache, reactivate)
   */
  async reloadPlugin(pluginId: string): Promise<void> {
    console.log(`[PluginManager] Reloading plugin: ${pluginId}`);

    const plugin = this.getPlugin(pluginId);
    if (!plugin) throw new Error(`Plugin ${pluginId} not found`);

    const path = await pluginLoader.getPluginPath(pluginId);
    if (!path) throw new Error(`Could not find path for plugin ${pluginId}`);

    // 1. Deactivate
    await this.deactivatePlugin(pluginId);

    // 2. Unload code (clears require cache)
    await pluginLoader.unloadPluginCode(pluginId, path);

    // 3. Reactivate
    await this.activatePlugin(pluginId);

    console.log(`[PluginManager] Plugin ${pluginId} reloaded successfully`);
  }

  /**
   * Start watching a plugin directory for changes
   */
  async watchPlugin(pluginId: string): Promise<void> {
    if (this.watchers.has(pluginId)) return;

    const pluginPath = await pluginLoader.getPluginPath(pluginId);
    if (!pluginPath) return;

    console.log(
      `[PluginManager] Starting watcher for ${pluginId} at ${pluginPath}`
    );

    try {
      const watcher = fs.watch(
        pluginPath,
        { recursive: true },
        (event, filename) => {
          console.log(
            `[PluginManager] Change detected in ${pluginId}: ${event} ${filename}`
          );
          // Debounce reload
          this.reloadPlugin(pluginId).catch((err) => {
            console.error(
              `[PluginManager] Auto-reload failed for ${pluginId}:`,
              err.message
            );
          });
        }
      );

      this.watchers.set(pluginId, watcher);
    } catch (error: any) {
      console.error(
        `[PluginManager] Failed to start watcher for ${pluginId}:`,
        error.message
      );
    }
  }

  /**
   * Stop watching a plugin directory
   */
  private stopWatcher(pluginId: string): void {
    const watcher = this.watchers.get(pluginId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(pluginId);
      console.log(`[PluginManager] Stopped watcher for ${pluginId}`);
    }
  }

  /**
   * Activate a plugin (load and run)
   */
  private async activatePlugin(pluginId: string): Promise<void> {
    try {
      const entry = pluginRegistry.getPlugin(pluginId);
      if (!entry) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      const plugin = entry.plugin;

      // Check license
      const licenseCheck = licenseManager.checkLicense(pluginId);
      if (!licenseCheck.valid) {
        throw new Error(`License validation failed: ${licenseCheck.error}`);
      }

      // Update state to loading
      pluginLoader.updatePluginState(pluginId, 'loading');

      // Get plugin path
      const pluginPath = await pluginLoader.getPluginPath(pluginId);
      if (!pluginPath) {
        throw new Error(`Plugin path not found for ${pluginId}`);
      }

      // Create plugin context
      const context = createPluginContext(
        pluginId,
        pluginPath,
        plugin.manifest.permissions || []
      );

      // Load plugin code
      const pluginModule = await pluginLoader.loadPluginCode(
        pluginId,
        pluginPath!
      );

      // Call activate method if it exists
      if (
        pluginModule.activate &&
        typeof pluginModule.activate === 'function'
      ) {
        await pluginModule.activate(context);
      }

      // Store context in registry
      pluginRegistry.setPluginContext(pluginId, context);

      // Update state to enabled
      pluginLoader.updatePluginState(pluginId, 'enabled');

      console.log(`[PluginManager] Plugin ${pluginId} activated successfully`);
    } catch (error: any) {
      console.error(
        `[PluginManager] Failed to activate plugin ${pluginId}:`,
        error.message
      );
      pluginLoader.updatePluginState(pluginId, 'error', error.message);
      throw error;
    }
  }

  /**
   * Deactivate a plugin (unload)
   */
  private async deactivatePlugin(pluginId: string): Promise<void> {
    try {
      const entry = pluginRegistry.getPlugin(pluginId);
      if (!entry) {
        return;
      }

      // Get plugin path
      const pluginPath = await pluginLoader.getPluginPath(pluginId);
      if (!pluginPath) {
        return;
      }

      // Load plugin code to call deactivate
      try {
        const pluginModule = await pluginLoader.loadPluginCode(
          pluginId,
          pluginPath!
        );

        // Call deactivate method if it exists
        if (
          pluginModule.deactivate &&
          typeof pluginModule.deactivate === 'function'
        ) {
          await pluginModule.deactivate();
        }
      } catch (error) {
        // Plugin might not be loaded, that's okay
      }

      // Unload plugin code
      await pluginLoader.unloadPluginCode(pluginId, pluginPath!);

      // Clear context
      pluginRegistry.clearPluginContext(pluginId);

      // Update state to disabled
      pluginLoader.updatePluginState(pluginId, 'disabled');

      console.log(
        `[PluginManager] Plugin ${pluginId} deactivated successfully`
      );
    } catch (error: any) {
      console.error(
        `[PluginManager] Failed to deactivate plugin ${pluginId}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Get plugin extensions for a specific extension point
   */
  getPluginExtensions(extensionPoint?: string): any[] {
    const allExtensions = getAllPluginExtensions();
    const results: any[] = [];

    for (const [pluginId, extensions] of allExtensions.entries()) {
      // Check if plugin is enabled
      if (!pluginRegistry.isPluginEnabled(pluginId)) {
        continue;
      }

      if (extensionPoint) {
        // Get specific extension point
        if (extensions[extensionPoint]) {
          results.push(...extensions[extensionPoint]);
        }
      } else {
        // Get all extensions
        results.push({ pluginId, extensions });
      }
    }

    return results;
  }

  /**
   * Execute a plugin action
   */
  async executePluginAction(
    pluginId: string,
    actionId: string,
    args?: any
  ): Promise<any> {
    const entry = pluginRegistry.getPlugin(pluginId);
    if (!entry) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (!pluginRegistry.isPluginEnabled(pluginId)) {
      throw new Error(`Plugin ${pluginId} is not enabled`);
    }

    // Get plugin path
    const pluginPath = await pluginLoader.getPluginPath(pluginId);
    if (!pluginPath) {
      throw new Error(`Plugin path not found for ${pluginId}`);
    }

    // Load plugin module
    const pluginModule = await pluginLoader.loadPluginCode(
      pluginId,
      pluginPath
    );

    // Find and execute the action
    if (
      pluginModule[actionId] &&
      typeof pluginModule[actionId] === 'function'
    ) {
      return await pluginModule[actionId](args);
    }

    throw new Error(`Action ${actionId} not found in plugin ${pluginId}`);
  }

  /**
   * Get plugin settings
   */
  getPluginSettings(pluginId: string): Record<string, any> {
    return pluginRegistry.getPluginSettings(pluginId);
  }

  /**
   * Update plugin settings
   */
  async updatePluginSettings(
    pluginId: string,
    settings: Record<string, any>
  ): Promise<void> {
    await pluginRegistry.updatePluginSettings(pluginId, settings);
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    console.log(`[PluginManager] Uninstalling plugin: ${pluginId}`);

    // Disable first if enabled
    if (pluginRegistry.isPluginEnabled(pluginId)) {
      await this.disablePlugin(pluginId);
    }

    // Unregister from registry and loader
    await pluginRegistry.unregisterPlugin(pluginId);
    pluginLoader.unregisterPlugin(pluginId);

    // Delete plugin files from disk
    try {
      const pluginPath = await pluginLoader.getPluginPath(pluginId);
      if (pluginPath) {
        await fs.promises.rm(pluginPath, { recursive: true, force: true });
        console.log(`[PluginManager] Deleted files for plugin ${pluginId}`);
      }
    } catch (error: any) {
      console.error(
        `[PluginManager] Failed to delete files for ${pluginId}:`,
        error.message
      );
    }

    console.log(`[PluginManager] Plugin ${pluginId} uninstalled successfully`);
  }

  /**
   * Rediscover a plugin and register it
   */
  async refreshDiscovery(pluginId: string): Promise<void> {
    console.log(`[PluginManager] Refreshing discovery for: ${pluginId}`);

    const pluginPath = await pluginLoader.getPluginPath(pluginId);
    if (!pluginPath) {
      console.warn(
        `[PluginManager] Could not find path for plugin ${pluginId}`
      );
      return;
    }

    const plugin = await pluginLoader.loadPluginFromDirectory(pluginPath);
    if (plugin) {
      pluginLoader.registerPlugin(plugin);
      await pluginRegistry.registerPlugin(plugin);
      console.log(
        `[PluginManager] Successfully discovered and registered ${pluginId}`
      );
    } else {
      console.warn(
        `[PluginManager] Could not load plugin ${pluginId} from ${pluginPath}`
      );
    }
  }
}

// Singleton instance
export const pluginManager = new PluginManager();
