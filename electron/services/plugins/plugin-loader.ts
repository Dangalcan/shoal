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
} from '../../types/plugin-types';
import { signatureService } from '../security/signature-service';
import { validateManifest, createErrorPlugin } from './plugin-validator';
import { executeInSandbox } from './plugin-sandbox';
import { getErrorMessage } from '../../utils/error-utils';
import log from '../../logger';

export class PluginLoader {
  private pluginDirectories: string[] = [];
  private loadedPlugins: Map<string, Plugin> = new Map();
  /** Per-plugin module cache used by the sandboxed require. */
  private sandboxCaches: Map<string, Map<string, unknown>> = new Map();

  constructor() {
    this.pluginDirectories = pathService.getDiscoveryDirectories();
    log.info('[PluginLoader] Plugin directories:', this.pluginDirectories);
  }

  /** Discover all plugins from configured directories. */
  async discoverPlugins(): Promise<Plugin[]> {
    const discovered: Plugin[] = [];

    for (const directory of this.pluginDirectories) {
      try {
        await fs.access(directory);
        const entries = await fs.readdir(directory, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const pluginPath = path.join(directory, entry.name);
            const plugin = await this.loadPluginFromDirectory(pluginPath);
            if (plugin) discovered.push(plugin);
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

      const isVerified = await signatureService.verifyPlugin(pluginPath);
      if (!isVerified) {
        log.error(
          `[PluginLoader] Signature verification failed for ${pluginPath}`
        );
        return createErrorPlugin(
          manifest,
          'Signature verification failed. Plugin may be tampered with.'
        );
      }

      const plugin: Plugin = {
        manifest,
        state: 'disabled',
        installedAt: new Date().toISOString(),
      };

      if (manifest.renderer) {
        const rendererPath = path.resolve(pluginPath, manifest.renderer);
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
  }

  async getPluginPath(pluginId: string): Promise<string | null> {
    return await pathService.resolvePluginPath(pluginId);
  }
}

export const pluginLoader = new PluginLoader();
