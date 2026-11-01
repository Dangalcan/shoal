/**
 * Plugin Manager
 *
 * Orchestrates plugin loading, activation, and lifecycle management.
 * Coordinates between loader, registry, and context.
 */

import type {
  Plugin,
  PluginConfig,
  PluginContext,
} from '../../types/plugin-types';
import type { PluginModuleHandle } from './host/module-handle';

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
import { assertValidPluginId } from './plugin-validator';
import {
  describeSignatureProblem,
  signatureService,
} from '../security/signature-service';
import { BUNDLED_DEFAULT_ENABLED } from '../../constants';
import { isMarketplaceEnabled } from '../../utils/env-utils';
import fs from 'fs';
import path from 'path';

/**
 * Upper bound for one lifecycle hook of an in-process (bundled) plugin. A
 * hook that has not returned by then fails the activation, which is rolled
 * back and reported, so Enable, Reload and start-up never hang on it; the
 * hook itself cannot be interrupted and keeps running in the background.
 * Isolated plugins have the host's own timeouts (plugin-host-manager.ts).
 */
export const HOOK_TIMEOUT_MS = 30_000;

/** Calls a lifecycle hook through a plugin module handle if it exists. */
async function callHookIfExists(
  handle: PluginModuleHandle,
  hookName: string,
  pluginId: string,
  context?: PluginContext
): Promise<void> {
  if (!handle.has(hookName)) return;
  log.info(`[PluginManager] Executing ${hookName} for ${pluginId}`);
  await handle.invoke(
    hookName,
    { withContext: context !== undefined, timeoutMs: HOOK_TIMEOUT_MS },
    context
  );
}

/** Exports the plugin manager calls itself; the UI cannot invoke them as actions. */
const LIFECYCLE_HOOKS = new Set([
  'beforeActivate',
  'activate',
  'afterActivate',
  'beforeDeactivate',
  'deactivate',
  'afterDeactivate',
]);

/** How long start-up waits for one plugin to activate before moving on. */
export const STARTUP_ACTIVATION_WAIT_MS = 5_000;

/**
 * Resolves true when `promise` settles within `ms`, false otherwise. The
 * promise itself keeps running either way.
 */
export async function settledWithin(
  promise: Promise<unknown>,
  ms: number
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  try {
    return await Promise.race([
      promise.then(
        () => true,
        () => true
      ),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class PluginManager {
  private initialized = false;
  // Activations still running, by plugin id (a settled copy: it never
  // rejects). disablePlugin() looks here to know that activate() is in flight.
  private activations = new Map<string, Promise<void>>();

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
        await pluginRegistry.registerPlugin(
          plugin,
          await this.getFirstRunConfig(plugin)
        );
      }

      // Auto-enable plugins that were previously enabled
      const enabledPlugins = pluginRegistry.getEnabledPlugins();
      log.info(
        `[PluginManager] Auto-enabling ${enabledPlugins.length} plugins`
      );

      for (const plugin of enabledPlugins) {
        const pluginId = plugin.manifest.id;
        const activation = this.activatePlugin(pluginId).catch(
          (error: unknown) => {
            log.error(
              `[PluginManager] Failed to auto-enable ${pluginId}:`,
              getErrorMessage(error)
            );
          }
        );
        // A plugin whose activate() hangs (kubectl waiting on an unreachable
        // cluster, a credential prompt) must not hold up the others: it keeps
        // activating in the background and the UI follows its state events.
        if (!(await settledWithin(activation, STARTUP_ACTIVATION_WAIT_MS))) {
          log.warn(
            `[PluginManager] ${pluginId} is still activating after ${STARTUP_ACTIVATION_WAIT_MS} ms; continuing start-up`
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
   * Bundled example plugins start enabled the first time they are seen.
   * Returns undefined (keep the saved or default config) in every other case.
   */
  private async getFirstRunConfig(
    plugin: Plugin
  ): Promise<PluginConfig | undefined> {
    const pluginId = plugin.manifest.id;
    if (!BUNDLED_DEFAULT_ENABLED.includes(pluginId)) return undefined;
    if (plugin.state === 'error') return undefined;
    if (await pluginRegistry.getPluginConfig(pluginId)) return undefined;
    return { enabled: true, settings: {} };
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
   * Check for updates for all installed plugins. A no-op while the
   * marketplace is disabled, so no request leaves the app.
   */
  async checkForUpdates(): Promise<void> {
    if (!isMarketplaceEnabled()) return;
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

    if (this.activations.has(pluginId)) {
      // activate() is still running (start-up waiting on kubectl, say) and
      // holds the instance whose timers must be cleared: tearing it down now
      // would deactivate a stale handle and let the activation finish into
      // "enabled". Flip the registry first, which the activation checks when
      // it settles, and let it stop its own instance (#78).
      await pluginRegistry.disablePlugin(pluginId);
      if (this.activations.has(pluginId)) {
        pluginLoader.updatePluginState(pluginId, 'disabled');
        log.info(
          `[PluginManager] Plugin ${pluginId} disabled; it is still activating and stops as soon as that settles`
        );
        return cascaded;
      }
      // The activation settled while the registry was being written: either
      // it stopped itself (state disabled) or it completed and the usual
      // deactivation applies.
      if (this.getPlugin(pluginId)?.state !== 'disabled') {
        await this.deactivatePlugin(pluginId);
      }
    } else {
      // Deactivate the plugin
      await this.deactivatePlugin(pluginId);

      // Disable in registry
      await pluginRegistry.disablePlugin(pluginId);
    }

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
  private activatePlugin(pluginId: string): Promise<void> {
    // The second caller (an Enable click during start-up) returns at once:
    // the running activation finishes on its own and the UI follows its
    // state events, as before the map existed.
    if (this.activations.has(pluginId)) {
      log.info(
        `[PluginManager] ${pluginId} is already activating; skipping a second activation`
      );
      return Promise.resolve();
    }
    const run = this.runActivation(pluginId);
    this.activations.set(
      pluginId,
      run.then(
        () => undefined,
        () => undefined
      )
    );
    return run.finally(() => {
      this.activations.delete(pluginId);
    });
  }

  private async runActivation(pluginId: string): Promise<void> {
    try {
      const entry = pluginRegistry.getPlugin(pluginId);
      if (!entry) throw new Error(`Plugin ${pluginId} not found`);
      const plugin = entry.plugin;

      // Start-up activates every enabled plugin while the user may already be
      // clicking Enable: a second activation would run activate() again (two
      // timers, two event subscriptions), so an active or activating plugin
      // is left alone.
      if (plugin.state === 'enabled' || plugin.state === 'loading') {
        log.info(
          `[PluginManager] ${pluginId} is already ${plugin.state === 'enabled' ? 'active' : 'activating'}; skipping a second activation`
        );
        return;
      }

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

      // Disable arrived while activate() was running (start-up waiting on
      // kubectl, the user clicking Disable): the registry already says
      // disabled, so the instance that just activated is stopped here, with
      // the context it received, instead of being marked enabled (#78).
      if (pluginRegistry.getPlugin(pluginId)?.config?.enabled === false) {
        log.info(
          `[PluginManager] ${pluginId} was disabled while activating; stopping it`
        );
        await this.deactivatePlugin(pluginId, context);
        return;
      }

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

    const handle = await pluginLoader.acquireModuleHandle(
      pluginId,
      pluginPath,
      context
    );
    try {
      await callHookIfExists(handle, 'beforeActivate', pluginId, context);
      await callHookIfExists(handle, 'activate', pluginId, context);
      await callHookIfExists(handle, 'afterActivate', pluginId, context);
    } catch (error: unknown) {
      // Rollback: clean up any extensions registered during partial activation
      try {
        await callHookIfExists(handle, 'deactivate', pluginId);
      } catch {
        // Best-effort rollback; the original activation error is rethrown below
      }
      clearPluginExtensions(pluginId);
      pluginLoader.releaseModuleHandle(pluginId);
      throw error;
    }
  }

  /**
   * Deactivate a plugin (unload)
   */
  private async deactivatePlugin(
    pluginId: string,
    // The context activate() received. The registry only holds it once an
    // activation has completed, so a plugin stopped mid-activation passes it.
    context: PluginContext | undefined = pluginRegistry.getPluginContext(
      pluginId
    ) as PluginContext | undefined
  ): Promise<void> {
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

      // Run deactivation hooks through the module handle (the running
      // utility process of an isolated plugin, the vm instance activate()
      // ran in for an in-process one)
      try {
        const handle = await pluginLoader.acquireModuleHandle(
          pluginId,
          pluginPath!,
          context
        );
        await callHookIfExists(handle, 'beforeDeactivate', pluginId, context);
        await callHookIfExists(handle, 'deactivate', pluginId);
        await callHookIfExists(handle, 'afterDeactivate', pluginId);
      } catch (error) {
        // Plugin might not be loaded, that's okay
        log.warn(
          `[PluginManager] Could not execute deactivation hooks for ${pluginId}:`,
          error
        );
      }

      // Tear down any isolated host process and unload plugin code
      pluginLoader.releaseModuleHandle(pluginId);
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
        const extList = (extensions as Record<string, unknown[] | undefined>)[
          extensionPoint
        ];
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
    if (LIFECYCLE_HOOKS.has(actionId)) {
      throw new Error(`"${actionId}" is a lifecycle hook, not an action`);
    }
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

    // Get a module handle (running utility process for isolated plugins,
    // the activated vm instance for in-process plugins)
    const context = pluginRegistry.getPluginContext(pluginId) as
      PluginContext | undefined;
    const handle = await pluginLoader.acquireModuleHandle(
      pluginId,
      pluginPath,
      context
    );

    // Find and execute the action
    if (!handle.has(actionId)) {
      throw new Error(`Action ${actionId} not found in plugin ${pluginId}`);
    }
    return await handle.invoke(actionId, { args: [args] }, context);
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

    // A bundled plugin is rediscovered (and re-enabled by the first-run
    // rule) on the next launch, so uninstalling it only confuses: refuse.
    if (await pathService.isBundledPluginId(pluginId)) {
      throw new Error(
        `${pluginId} is bundled with Shoal and cannot be uninstalled; disable it instead`
      );
    }

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
        // Strictly inside the user plugins directory: an empty relative path
        // would be the directory itself, and rm -rf of it deletes every
        // user plugin.
        const isUserPlugin =
          relative !== '' &&
          !relative.startsWith('..') &&
          !path.isAbsolute(relative);

        if (isUserPlugin) {
          await fs.promises.rm(pluginPath, { recursive: true, force: true });
          log.info(`[PluginManager] Deleted files for plugin ${pluginId}`);
          // Its stored data goes too: the key-value rows and the storage
          // directory (database, logs, cache) under the plugin's own id.
          storageService.clear(pluginId);
          await fs.promises.rm(pathService.getPluginStorageDir(pluginId), {
            recursive: true,
            force: true,
          });
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
      // Guard against path traversal via a crafted id before building paths.
      assertValidPluginId(manifest.id);
      if (await pathService.isBundledPluginId(manifest.id)) {
        throw new Error(
          `Plugin id "${manifest.id}" belongs to a plugin bundled with Shoal`
        );
      }

      // Refuse before copying: an unverifiable plugin would only sit in the
      // plugins folder as an error card.
      const verification = await signatureService.checkPlugin(sourcePath);
      if (!verification.ok) {
        throw new Error(describeSignatureProblem(verification.problem));
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
