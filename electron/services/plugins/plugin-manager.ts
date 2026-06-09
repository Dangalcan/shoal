/**
 * Plugin Manager
 *
 * Orchestrates plugin loading, activation, and lifecycle management.
 * Coordinates between loader, registry, and context.
 */

import type { Plugin, PluginContext } from '../../types/plugin-types';

interface PluginUpdateInfo {
  pluginId: string;
  hasUpdate: boolean;
  latestVersion: string;
}
import log from '../../logger';
import { getErrorMessage } from '../../utils/error-utils';
import { pluginLoader } from './plugin-loader';
import { pluginRegistry } from './plugin-registry';
import { createPluginContext } from './plugin-context';
import {
  getAllPluginExtensions,
  clearPluginExtensions,
} from './plugin-extensions';
import { storageService } from './storage-service';
import { licenseManager } from '../security/license-manager';
import { marketplaceService } from '../marketplace/marketplace-service';
import { dependencyResolver } from './dependency-resolver';
import { dataLoader } from './data-loader';
import { pluginEventBus } from './plugin-events';
import { pluginWatcher } from './plugin-watcher';
import { pathService } from './path-service';
import fs from 'fs';
import path from 'path';

/** Calls a lifecycle hook on a plugin module if it exists, logging before invocation. */
async function callHookIfExists(
  pluginModule: Record<string, unknown>,
  hookName: string,
  pluginId: string,
  ...args: unknown[]
): Promise<void> {
  const hook = pluginModule[hookName];
  if (hook && typeof hook === 'function') {
    log.info(`[PluginManager] Executing ${hookName} for ${pluginId}`);
    await (hook as (...a: unknown[]) => Promise<void>)(...args);
  }
}

export class PluginManager {
  private initialized = false;

  /**
   * Initialize the plugin system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      log.warn('[PluginManager] Already initialized');
      return;
    }

    try {
      log.info('[PluginManager] Initializing plugin system...');

      // Initialize registry
      await pluginRegistry.initialize();

      // Discover plugins
      const discoveredPlugins = await pluginLoader.discoverPlugins();
      log.info(
        `[PluginManager] Discovered ${discoveredPlugins.length} plugins`
      );

      // Register discovered plugins
      for (const plugin of discoveredPlugins) {
        pluginLoader.registerPlugin(plugin);
        await pluginRegistry.registerPlugin(plugin);
      }

      // Auto-enable plugins that were previously enabled
      const enabledPlugins = pluginRegistry.getEnabledPlugins();
      log.info(
        `[PluginManager] Auto-enabling ${enabledPlugins.length} plugins`
      );

      for (const plugin of enabledPlugins) {
        try {
          await this.activatePlugin(plugin.manifest.id);
        } catch (error: unknown) {
          log.error(
            `[PluginManager] Failed to auto-enable ${plugin.manifest.id}:`,
            getErrorMessage(error)
          );
        }
      }

      this.initialized = true;
      log.info('[PluginManager] Plugin system initialized successfully');
    } catch (error: unknown) {
      log.error(
        '[PluginManager] Failed to initialize:',
        getErrorMessage(error)
      );
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
      for (const update of result.data as PluginUpdateInfo[]) {
        const plugin = this.getPlugin(update.pluginId);
        if (plugin && update.hasUpdate) {
          plugin.hasUpdate = true;
          plugin.latestVersion = update.latestVersion;
        }
      }
    }
  }

  /**
   * Enable a plugin.
   * Returns the IDs of any dependency plugins that were auto-enabled as a side effect.
   */
  async enablePlugin(pluginId: string): Promise<string[]> {
    log.info(`[PluginManager] Enabling plugin: ${pluginId}`);

    // Check if plugin exists
    if (!pluginRegistry.hasPlugin(pluginId)) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Snapshot which deps are currently disabled so we can report what was auto-enabled
    const pluginEntry = pluginRegistry.getPlugin(pluginId);
    const plugin = pluginEntry?.plugin;
    const depIds = plugin?.manifest?.dependencies
      ? Object.keys(plugin.manifest.dependencies)
      : [];
    const prevDisabledDeps = depIds.filter(
      (depId) => !pluginRegistry.getPlugin(depId)?.config.enabled
    );

    // Enable in registry
    await pluginRegistry.enablePlugin(pluginId);

    // Activate the plugin (this may auto-enable disabled dependencies)
    await this.activatePlugin(pluginId);

    // Return the deps that are now enabled but were disabled before
    const autoDeps = prevDisabledDeps.filter(
      (depId) => pluginRegistry.getPlugin(depId)?.config.enabled
    );

    log.info(`[PluginManager] Plugin ${pluginId} enabled successfully`);
    return autoDeps;
  }

  /**
   * Disable a plugin.
   * Returns the IDs of any plugins that were cascade-disabled as a side effect.
   */
  async disablePlugin(pluginId: string): Promise<string[]> {
    log.info(`[PluginManager] Disabling plugin: ${pluginId}`);

    // Check if plugin exists
    if (!pluginRegistry.hasPlugin(pluginId)) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // --- Cascading Disable Logic ---
    const cascaded: string[] = [];
    const activePlugins = pluginRegistry.getEnabledPlugins();
    const dependents = dependencyResolver.getDependents(
      pluginId,
      activePlugins
    );

    if (dependents.length > 0) {
      log.info(
        `[PluginManager] Plugin ${pluginId} has ${dependents.length} dependent(s). Disabling them first.`
      );
      for (const dependent of dependents) {
        log.info(
          `[PluginManager] Cascading disable for dependent: ${dependent.manifest.id}`
        );
        const subCascaded = await this.disablePlugin(dependent.manifest.id);
        cascaded.push(dependent.manifest.id, ...subCascaded);
      }
    }
    // -------------------------------

    // Stop watcher if exists
    this.stopWatcher(pluginId);

    // Deactivate the plugin
    await this.deactivatePlugin(pluginId);

    // Disable in registry
    await pluginRegistry.disablePlugin(pluginId);

    log.info(`[PluginManager] Plugin ${pluginId} disabled successfully`);
    return cascaded;
  }

  /**
   * Reload a plugin (deactivate, clear cache, reactivate)
   */
  async reloadPlugin(pluginId: string): Promise<void> {
    log.info(`[PluginManager] Reloading plugin: ${pluginId}`);

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

    log.info(`[PluginManager] Plugin ${pluginId} reloaded successfully`);
  }

  /**
   * Start watching a plugin directory for changes
   */
  async watchPlugin(pluginId: string): Promise<void> {
    await pluginWatcher.watch(pluginId, (id) => this.reloadPlugin(id));
  }

  /**
   * Stop watching a plugin directory
   */
  private stopWatcher(pluginId: string): void {
    pluginWatcher.stop(pluginId);
  }

  /**
   * Activate a plugin (load and run)
   */
  private async activatePlugin(pluginId: string): Promise<void> {
    try {
      const entry = pluginRegistry.getPlugin(pluginId);
      if (!entry) throw new Error(`Plugin ${pluginId} not found`);
      const plugin = entry.plugin;

      await this.validateAndEnableDeps(plugin, pluginId);

      const licenseCheck = licenseManager.checkLicense(pluginId);
      if (!licenseCheck.valid) {
        throw new Error(`License validation failed: ${licenseCheck.error}`);
      }

      pluginLoader.updatePluginState(pluginId, 'loading');

      const pluginPath = await pluginLoader.getPluginPath(pluginId);
      if (!pluginPath) throw new Error(`Plugin path not found for ${pluginId}`);

      const context = createPluginContext(
        pluginId,
        pluginPath,
        plugin.manifest.permissions || []
      );
      await this.loadAndExecutePlugin(pluginId, pluginPath, plugin, context);

      pluginRegistry.setPluginContext(pluginId, context);
      pluginLoader.updatePluginState(pluginId, 'enabled');
      pluginEventBus.emitPluginActivated(pluginId);

      log.info(`[PluginManager] Plugin ${pluginId} activated successfully`);
    } catch (error: unknown) {
      log.error(
        `[PluginManager] Failed to activate plugin ${pluginId}:`,
        getErrorMessage(error)
      );
      pluginLoader.updatePluginState(pluginId, 'error', getErrorMessage(error));
      throw error;
    }
  }

  /** Validate dependency graph and auto-enable any disabled deps. */
  private async validateAndEnableDeps(
    plugin: Plugin,
    pluginId: string
  ): Promise<void> {
    const allPlugins = new Map(
      pluginRegistry.getAllPlugins().map((p) => [p.manifest.id, p])
    );
    const validation = dependencyResolver.validateDependencies(
      plugin,
      allPlugins
    );

    if (!validation.valid) {
      let errorMsg = `Cannot activate plugin ${pluginId}:\n`;
      if (validation.missing.length > 0) {
        errorMsg += `Missing dependencies: ${validation.missing.join(', ')}\n`;
      }
      if (validation.incompatible.length > 0) {
        errorMsg += 'Incompatible dependencies:\n';
        validation.incompatible.forEach(({ pluginId, required, installed }) => {
          errorMsg += `  - ${pluginId}: requires ${required}, but ${installed} is installed\n`;
        });
      }
      if (validation.circular.length > 0) {
        errorMsg += `Circular dependencies detected: ${validation.circular
          .map((c) => c.join(' -> '))
          .join(', ')}`;
      }
      throw new Error(errorMsg);
    }

    if (plugin.manifest.dependencies) {
      for (const depId of Object.keys(plugin.manifest.dependencies)) {
        const depEntry = pluginRegistry.getPlugin(depId);
        if (depEntry && !depEntry.config.enabled) {
          log.info(`[PluginManager] Auto-enabling dependency: ${depId}`);
          await this.enablePlugin(depId);
        }
      }
    }
  }

  /** Migrate storage, load data files, execute plugin module lifecycle hooks. */
  private async loadAndExecutePlugin(
    pluginId: string,
    pluginPath: string,
    plugin: Plugin,
    context: PluginContext
  ): Promise<void> {
    await storageService.migrateFromJson(pluginId);

    try {
      const dataFiles = await dataLoader.loadPluginData(
        pluginPath,
        plugin.manifest
      );
      if (dataFiles.length > 0) {
        log.info(
          `[PluginManager] Loaded ${dataFiles.length} data files for ${pluginId}`
        );
        await dataLoader.applyDataToStorage(
          pluginId,
          dataFiles,
          context.storage
        );
      }
    } catch (error: unknown) {
      log.error(
        `[PluginManager] Failed to load data for ${pluginId}:`,
        getErrorMessage(error)
      );
      throw error;
    }

    const pluginModule = await pluginLoader.loadPluginCode(
      pluginId,
      pluginPath
    );
    const mod = pluginModule as Record<string, unknown>;
    try {
      await callHookIfExists(mod, 'beforeActivate', pluginId, context);
      await callHookIfExists(mod, 'activate', pluginId, context);
      await callHookIfExists(mod, 'afterActivate', pluginId, context);
    } catch (error: unknown) {
      // Rollback: clean up any extensions registered during partial activation
      try {
        await callHookIfExists(mod, 'deactivate', pluginId);
      } catch (_) {}
      clearPluginExtensions(pluginId);
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

      // Get plugin context
      const context = pluginRegistry.getPluginContext(pluginId);

      // Load plugin code to call deactivate
      try {
        const pluginModule = await pluginLoader.loadPluginCode(
          pluginId,
          pluginPath!
        );

        await callHookIfExists(
          pluginModule as Record<string, unknown>,
          'beforeDeactivate',
          pluginId,
          context
        );
        await callHookIfExists(
          pluginModule as Record<string, unknown>,
          'deactivate',
          pluginId
        );
        await callHookIfExists(
          pluginModule as Record<string, unknown>,
          'afterDeactivate',
          pluginId
        );
      } catch (error) {
        // Plugin might not be loaded, that's okay
        log.warn(
          `[PluginManager] Could not execute deactivation hooks for ${pluginId}:`,
          error
        );
      }

      // Unload plugin code
      await pluginLoader.unloadPluginCode(pluginId, pluginPath!);

      // Clear plugin extensions
      clearPluginExtensions(pluginId);

      // Clear context
      pluginRegistry.clearPluginContext(pluginId);

      // Update state to disabled
      pluginLoader.updatePluginState(pluginId, 'disabled');

      // Emit plugin deactivated event
      pluginEventBus.emitPluginDeactivated(pluginId);

      log.info(`[PluginManager] Plugin ${pluginId} deactivated successfully`);
    } catch (error: unknown) {
      log.error(
        `[PluginManager] Failed to deactivate plugin ${pluginId}:`,
        getErrorMessage(error)
      );
      throw error;
    }
  }

  /**
   * Get plugin extensions for a specific extension point
   */
  getPluginExtensions(extensionPoint?: string): unknown[] {
    const allExtensions = getAllPluginExtensions();
    const results: unknown[] = [];

    for (const [pluginId, extensions] of allExtensions.entries()) {
      // Check if plugin is enabled
      if (!pluginRegistry.isPluginEnabled(pluginId)) {
        continue;
      }

      if (extensionPoint) {
        // Get specific extension point
        const extList = (extensions as any)[extensionPoint];
        if (extList) {
          results.push(...extList);
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
    args?: unknown
  ): Promise<unknown> {
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
  getPluginSettings(pluginId: string): Record<string, unknown> {
    return pluginRegistry.getPluginSettings(pluginId);
  }

  /**
   * Update plugin settings
   */
  async updatePluginSettings(
    pluginId: string,
    settings: Record<string, unknown>
  ): Promise<void> {
    await pluginRegistry.updatePluginSettings(pluginId, settings);
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    log.info(`[PluginManager] Uninstalling plugin: ${pluginId}`);

    // --- Cascading Uninstall Logic ---
    const installedPlugins = pluginRegistry.getAllPlugins();
    const dependents = dependencyResolver.getDependents(
      pluginId,
      installedPlugins
    );

    if (dependents.length > 0) {
      log.info(
        `[PluginManager] Plugin ${pluginId} has ${dependents.length} dependent(s). Uninstalling them first.`
      );
      for (const dependent of dependents) {
        log.info(
          `[PluginManager] Cascading uninstall for dependent: ${dependent.manifest.id}`
        );
        await this.uninstallPlugin(dependent.manifest.id);
      }
    }
    // -------------------------------

    // Disable first if enabled
    if (pluginRegistry.isPluginEnabled(pluginId)) {
      await this.disablePlugin(pluginId);
    }

    // Unregister from registry and loader
    await pluginRegistry.unregisterPlugin(pluginId);
    pluginLoader.unregisterPlugin(pluginId);

    // Delete plugin files from disk only if they are in the user-installed directory
    try {
      const pluginPath = await pluginLoader.getPluginPath(pluginId);
      if (!pluginPath)
        log.error(`[ERROR] getPluginPath returned undefined for ${pluginId}`);
      if (pluginPath) {
        const pluginsDir = path.resolve(pathService.getUserPluginsDir());
        const absPluginPath = path.resolve(pluginPath);
        const relative = path.relative(pluginsDir, absPluginPath);
        const isUserPlugin =
          !relative.startsWith('..') && !path.isAbsolute(relative);

        if (isUserPlugin) {
          await fs.promises.rm(pluginPath, { recursive: true, force: true });
          log.info(`[PluginManager] Deleted files for plugin ${pluginId}`);
        } else {
          log.info(
            `[PluginManager] Plugin ${pluginId} is a bundled plugin, skipping file deletion`
          );
        }
      }
    } catch (error: unknown) {
      log.error(
        `[PluginManager] Failed to delete files for ${pluginId}:`,
        getErrorMessage(error)
      );
    }

    log.info(`[PluginManager] Plugin ${pluginId} uninstalled successfully`);
  }

  /**
   * Import a plugin from a local directory
   */
  async importPlugin(sourcePath: string): Promise<string> {
    log.info(`[PluginManager] Importing plugin from: ${sourcePath}`);

    try {
      // 1. Validate source directory
      const stats = await fs.promises.stat(sourcePath);
      if (!stats.isDirectory()) {
        throw new Error('Source path must be a directory');
      }

      // 2. Read manifest to get ID
      const manifestPath = path.join(sourcePath, 'plugin.json');
      const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      if (!manifest.id) {
        throw new Error('Invalid manifest: missing plugin ID');
      }

      // Determine install path (usually userData/plugins)
      const targetPath = path.join(
        pathService.getUserPluginsDir(),
        manifest.id
      );

      // 4. Check if already exists
      try {
        await fs.promises.access(targetPath);
        throw new Error(`Plugin ${manifest.id} already exists`);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('already exists'))
          throw err;
        // Continue if doesn't exist
      }

      // 5. Copy files
      // Node.js fs.cp is available in recent versions (added in v16.7.0)
      log.info(`[PluginManager] Copying to ${targetPath}`);
      await fs.promises.cp(sourcePath, targetPath, { recursive: true });

      // 6. Refresh discovery
      await this.refreshDiscovery(manifest.id);

      log.info(`[PluginManager] Imported ${manifest.id} successfully`);
      return manifest.id;
    } catch (error: unknown) {
      log.error('[PluginManager] Import failed:', error);
      throw error;
    }
  }

  /**
   * Rediscover a plugin and register it
   */
  async refreshDiscovery(pluginId: string): Promise<void> {
    log.info(`[PluginManager] Refreshing discovery for: ${pluginId}`);

    const pluginPath = await pluginLoader.getPluginPath(pluginId);
    if (!pluginPath) {
      log.warn(`[PluginManager] Could not find path for plugin ${pluginId}`);
      return;
    }

    const plugin = await pluginLoader.loadPluginFromDirectory(pluginPath);
    if (plugin) {
      pluginLoader.registerPlugin(plugin);
      await pluginRegistry.registerPlugin(plugin);
      log.info(
        `[PluginManager] Successfully discovered and registered ${pluginId}`
      );
    } else {
      log.warn(
        `[PluginManager] Could not load plugin ${pluginId} from ${pluginPath}`
      );
    }
  }
}

// Singleton instance
export const pluginManager = new PluginManager();
