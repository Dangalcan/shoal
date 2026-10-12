/**
 * Plugin Loader
 *
 * Discovers plugins from configured directories, loads their manifests,
 * and manages per-plugin state. Validation logic lives in plugin-validator.ts;
 * VM sandboxing lives in plugin-sandbox.ts.
 */

import fs from 'fs/promises';
import path from 'path';
import { pathService } from './path-service';
import type {
  PluginManifest,
  Plugin,
  PluginState,
  PluginContext,
} from '../../types/plugin-types';
import {
  describeSignatureProblem,
  signatureService,
} from '../security/signature-service';
import { validateManifest, createErrorPlugin } from './plugin-validator';
import { executeInSandbox } from './plugin-sandbox';
import { LocalPluginModule } from './host/module-handle';
import type { PluginModuleHandle } from './host/module-handle';
import { pluginHostManager } from './host/plugin-host-manager';
import { getErrorMessage } from '../../utils/error-utils';
import { isPathInside } from '../../utils/fs-utils';
import { isProduction } from '../../utils/env-utils';
import log from '../../logger';
import { pluginEventBus } from './plugin-events';

export class PluginLoader {
  private pluginDirectories: string[] = [];
  private loadedPlugins: Map<string, Plugin> = new Map();
  /** Per-plugin module cache used by the sandboxed require. */
  private sandboxCaches: Map<string, Map<string, unknown>> = new Map();
  /** Live handles for plugins running in isolated utility processes. */
  private remoteHandles: Map<string, PluginModuleHandle> = new Map();

  constructor() {
    this.pluginDirectories = pathService.getDiscoveryDirectories();
    log.info('[PluginLoader] Plugin directories:', this.pluginDirectories);
  }

  /**
   * Discover all plugins from configured directories. The first directory
   * (bundled plugins) wins: a later plugin reusing an id is skipped, so a
   * user-installed copy cannot replace a bundled plugin.
   */
  async discoverPlugins(): Promise<Plugin[]> {
    const discovered: Plugin[] = [];
    const seenIds = new Set<string>();

    for (const directory of this.pluginDirectories) {
      try {
        await fs.access(directory);
        const entries = await fs.readdir(directory, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const pluginPath = path.join(directory, entry.name);
            const plugin = await this.loadPluginFromDirectory(pluginPath);
            if (!plugin) continue;
            if (seenIds.has(plugin.manifest.id)) {
              log.warn(
                `[PluginLoader] Skipping ${pluginPath}: plugin id "${plugin.manifest.id}" is already taken`
              );
              continue;
            }
            seenIds.add(plugin.manifest.id);
            discovered.push(plugin);
          }
        }
      } catch {
        log.info(`[PluginLoader] Directory not accessible: ${directory}`);
      }
    }

    return discovered;
  }

  /** Load a single plugin from a directory path. */
  async loadPluginFromDirectory(pluginPath: string): Promise<Plugin | null> {
    try {
      const manifestPath = path.join(pluginPath, 'plugin.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestContent);

      const validationError = validateManifest(manifest);
      if (validationError) {
        log.error(
          `[PluginLoader] Invalid manifest for ${pluginPath}:`,
          validationError
        );
        return createErrorPlugin(manifest, validationError);
      }

      const verification = await signatureService.checkPlugin(pluginPath);
      if (!verification.ok) {
        log.error(
          `[PluginLoader] Signature verification failed for ${pluginPath}`
        );
        return createErrorPlugin(
          manifest,
          describeSignatureProblem(verification.problem)
        );
      }

      const plugin: Plugin = {
        manifest,
        state: 'disabled',
        installedAt: new Date().toISOString(),
      };

      if (manifest.renderer) {
        const rendererPath = path.resolve(pluginPath, manifest.renderer);
        if (!isPathInside(pluginPath, rendererPath)) {
          return createErrorPlugin(
            manifest,
            `Renderer entry escapes the plugin directory: ${manifest.renderer}`
          );
        }
        try {
          await fs.access(rendererPath);
          plugin.rendererEntry = rendererPath;
        } catch {
          log.warn(
            `[PluginLoader] Renderer entry not found for ${manifest.id}: ${rendererPath}`
          );
        }
      }

      if (manifest.styles && Array.isArray(manifest.styles)) {
        plugin.rendererStyles = [];
        for (const stylePath of manifest.styles) {
          const fullStylePath = path.resolve(pluginPath, stylePath);
          if (!isPathInside(pluginPath, fullStylePath)) {
            return createErrorPlugin(
              manifest,
              `Stylesheet escapes the plugin directory: ${stylePath}`
            );
          }
          try {
            await fs.access(fullStylePath);
            plugin.rendererStyles.push(fullStylePath);
          } catch {
            log.warn(
              `[PluginLoader] Style not found for ${manifest.id}: ${fullStylePath}`
            );
          }
        }
      }

      log.info(
        `[PluginLoader] Discovered plugin: ${manifest.name} (${manifest.id})`
      );
      return plugin;
    } catch (error: unknown) {
      log.error(
        `[PluginLoader] Failed to load plugin from ${pluginPath}:`,
        getErrorMessage(error)
      );
      return null;
    }
  }

  /**
   * Load plugin code into a VM sandbox (activate).
   * Returns the plugin's exports object.
   */
  async loadPluginCode(
    pluginId: string,
    pluginPath: string
  ): Promise<Record<string, unknown>> {
    try {
      const plugin = this.loadedPlugins.get(pluginId);
      if (!plugin) throw new Error(`Plugin ${pluginId} not found`);

      const mainFile = path.join(
        pluginPath,
        plugin.manifest.main || 'index.js'
      );
      await fs.access(mainFile);

      const code = await fs.readFile(mainFile, 'utf8');
      const moduleCache = new Map<string, unknown>();
      const pluginModule = executeInSandbox(
        code,
        mainFile,
        pluginPath,
        moduleCache
      );

      this.sandboxCaches.set(pluginId, moduleCache);
      log.info(`[PluginLoader] Loaded plugin code for ${pluginId} (sandboxed)`);
      return pluginModule as Record<string, unknown>;
    } catch (error: unknown) {
      log.error(
        `[PluginLoader] Failed to load plugin code for ${pluginId}:`,
        getErrorMessage(error)
      );
      throw error;
    }
  }

  /** Unload plugin code — clears the sandbox module cache. */
  async unloadPluginCode(pluginId: string, _pluginPath: string): Promise<void> {
    try {
      this.sandboxCaches.delete(pluginId);
      log.info(`[PluginLoader] Unloaded plugin code for ${pluginId}`);
    } catch (error: unknown) {
      log.error(
        `[PluginLoader] Failed to unload plugin code for ${pluginId}:`,
        getErrorMessage(error)
      );
    }
  }

  /**
   * Whether a plugin should run in an isolated utility process.
   * Default policy: user-installed (untrusted) plugins are isolated; bundled
   * in-tree plugins stay in-process. Override with PLUGIN_ISOLATION=all|off
   * (`off` only outside packaged builds).
   */
  shouldIsolatePlugin(pluginPath: string): boolean {
    const mode = process.env.PLUGIN_ISOLATION;
    if (mode === 'off') {
      // A debugging switch; it must never lower isolation for real users.
      if (isProduction()) {
        log.warn(
          '[PluginLoader] PLUGIN_ISOLATION=off is ignored in packaged builds'
        );
      } else {
        return false;
      }
    }
    if (!pluginHostManager.isSupported()) return false;
    if (mode === 'all') return true;

    try {
      const userDir = path.resolve(pathService.getUserPluginsDir());
      const relative = path.relative(userDir, path.resolve(pluginPath));
      return !relative.startsWith('..') && !path.isAbsolute(relative);
    } catch {
      return false;
    }
  }

  /**
   * Get a callable handle to the plugin module. Isolated plugins reuse their
   * running utility process; in-process plugins re-execute the vm sandbox
   * (same semantics as loadPluginCode).
   */
  async acquireModuleHandle(
    pluginId: string,
    pluginPath: string,
    context?: PluginContext
  ): Promise<PluginModuleHandle> {
    const existing = this.remoteHandles.get(pluginId);
    if (existing && pluginHostManager.isRunning(pluginId)) {
      return existing;
    }
    this.remoteHandles.delete(pluginId);

    if (this.shouldIsolatePlugin(pluginPath)) {
      if (!context) {
        throw new Error(
          `Plugin ${pluginId} is isolated and requires a context to load`
        );
      }
      const plugin = this.loadedPlugins.get(pluginId);
      if (!plugin) throw new Error(`Plugin ${pluginId} not found`);
      const mainFile = path.join(
        pluginPath,
        plugin.manifest.main || 'index.js'
      );
      await fs.access(mainFile);

      const handle = await pluginHostManager.spawn({
        pluginId,
        pluginPath,
        mainFile,
        permissions: plugin.manifest.permissions || [],
        context,
      });
      this.remoteHandles.set(pluginId, handle);
      return handle;
    }

    const moduleExports = await this.loadPluginCode(pluginId, pluginPath);
    return new LocalPluginModule(moduleExports);
  }

  /** Dispose any isolated host process and clear caches for a plugin. */
  releaseModuleHandle(pluginId: string): void {
    const handle = this.remoteHandles.get(pluginId);
    this.remoteHandles.delete(pluginId);
    handle?.dispose();
    pluginHostManager.disposePlugin(pluginId);
  }

  registerPlugin(plugin: Plugin): void {
    this.loadedPlugins.set(plugin.manifest.id, plugin);
  }

  unregisterPlugin(pluginId: string): void {
    this.loadedPlugins.delete(pluginId);
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return this.loadedPlugins.get(pluginId);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  updatePluginState(
    pluginId: string,
    state: PluginState,
    error?: string
  ): void {
    const plugin = this.loadedPlugins.get(pluginId);
    if (plugin) {
      plugin.state = state;
      if (error) {
        plugin.error = error;
      } else {
        delete plugin.error;
      }
    }
    pluginEventBus.emitPluginStateChanged({ pluginId, state, error });
  }

  async getPluginPath(pluginId: string): Promise<string | null> {
    return await pathService.resolvePluginPath(pluginId);
  }
}

export const pluginLoader = new PluginLoader();
