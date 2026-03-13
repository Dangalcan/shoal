/**
 * Plugin Loader
 *
 * Responsible for discovering, loading, and managing plugins in the main process.
 * Handles plugin lifecycle, validation, and security.
 */

import fs from 'fs/promises';
import { readFileSync } from 'fs';
import path from 'path';
import vm from 'vm';
import semver from 'semver';
import { pathService } from './path-service';
import type {
  PluginManifest,
  Plugin,
  PluginState,
} from '../../types/plugin-types';
import { signatureService } from '../security/signature-service';
import log from '../../logger';

// Node.js built-ins that are safe to expose to plugin code (no I/O, no process spawning)
const ALLOWED_BUILTINS = new Set([
  'path',
  'util',
  'os',
  'url',
  'querystring',
  'events',
  'stream',
  'crypto',
]);

export class PluginLoader {
  private pluginDirectories: string[] = [];
  private loadedPlugins: Map<string, Plugin> = new Map();
  // Per-plugin module cache used by the sandboxed require (replaces require.cache)
  private sandboxCaches: Map<string, Map<string, any>> = new Map();

  constructor() {
    this.initializePluginDirectories();
  }

  /**
   * Initialize plugin discovery directories
   */
  private initializePluginDirectories(): void {
    this.pluginDirectories = pathService.getDiscoveryDirectories();
    log.info('[PluginLoader] Plugin directories:', this.pluginDirectories);
  }

  /**
   * Discover all plugins from configured directories
   */
  async discoverPlugins(): Promise<Plugin[]> {
    const discoveredPlugins: Plugin[] = [];

    for (const directory of this.pluginDirectories) {
      try {
        // Check if directory exists
        await fs.access(directory);

        // Read all subdirectories (each is a potential plugin)
        const entries = await fs.readdir(directory, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const pluginPath = path.join(directory, entry.name);
            const plugin = await this.loadPluginFromDirectory(pluginPath);

            if (plugin) {
              discoveredPlugins.push(plugin);
            }
          }
        }
      } catch (error: unknown) {
        // Directory doesn't exist or can't be read - this is okay
        log.info(`[PluginLoader] Directory not accessible: ${directory}`);
      }
    }

    return discoveredPlugins;
  }

  /**
   * Load a plugin from a directory
   */
  async loadPluginFromDirectory(pluginPath: string): Promise<Plugin | null> {
    try {
      // Read and validate manifest
      const manifestPath = path.join(pluginPath, 'plugin.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestContent);

      // Validate manifest
      const validationError = this.validateManifest(manifest);
      if (validationError) {
        log.error(
          `[PluginLoader] Invalid manifest for ${pluginPath}:`,
          validationError
        );
        return this.createErrorPlugin(manifest, validationError);
      }

      // Verify signature
      const isVerified = await signatureService.verifyPlugin(pluginPath);
      if (!isVerified) {
        log.error(
          `[PluginLoader] Signature verification failed for ${pluginPath}`
        );
        return this.createErrorPlugin(
          manifest,
          'Signature verification failed. Plugin may be tampered with.'
        );
      }

      // Create plugin instance
      const plugin: Plugin = {
        manifest,
        state: 'disabled',
        installedAt: new Date().toISOString(),
      };

      // Resolve renderer entry if present
      if (manifest.renderer) {
        const rendererPath = path.resolve(pluginPath, manifest.renderer);
        // Verify it exists
        try {
          await fs.access(rendererPath);
          plugin.rendererEntry = rendererPath;
        } catch (err) {
          log.warn(
            `[PluginLoader] Renderer entry not found for ${manifest.id}: ${rendererPath}`
          );
        }
      }

      // Resolve renderer styles if present
      if (manifest.styles && Array.isArray(manifest.styles)) {
        plugin.rendererStyles = [];
        for (const stylePath of manifest.styles) {
          const fullStylePath = path.resolve(pluginPath, stylePath);
          try {
            await fs.access(fullStylePath);
            plugin.rendererStyles.push(fullStylePath);
          } catch (err) {
            log.warn(
              `[PluginLoader] Style entry not found for ${manifest.id}: ${fullStylePath}`
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
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  /**
   * Validate plugin manifest
   */
  private validateManifest(manifest: PluginManifest): string | null {
    // Required fields
    if (!manifest.id) return 'Missing required field: id';
    if (!manifest.name) return 'Missing required field: name';
    if (!manifest.version) return 'Missing required field: version';
    if (!manifest.description) return 'Missing required field: description';
    if (!manifest.author) return 'Missing required field: author';
    if (!manifest.main) return 'Missing required field: main';
    if (!manifest.permissions) return 'Missing required field: permissions';
    if (!manifest.license) return 'Missing required field: license';

    // Validate ID format (alphanumeric, hyphens, underscores only)
    if (!/^[a-z0-9-_]+$/i.test(manifest.id)) {
      return 'Invalid plugin ID format (use alphanumeric, hyphens, and underscores only)';
    }

    // Validate version format (semver)
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      return 'Invalid version format (use semver: x.y.z)';
    }

    // Validate permissions
    const validPermissions = [
      'kubernetes',
      'filesystem',
      'network',
      'ui',
      'storage',
      'notifications',
    ];
    for (const permission of manifest.permissions) {
      if (!validPermissions.includes(permission)) {
        return `Invalid permission: ${permission}`;
      }
    }

    // Validate license type
    const validLicenseTypes = ['free', 'paid', 'trial', 'subscription'];
    if (!validLicenseTypes.includes(manifest.license.type)) {
      return `Invalid license type: ${manifest.license.type}`;
    }

    // If paid, validate pricing info
    if (
      manifest.license.type === 'paid' ||
      manifest.license.type === 'subscription'
    ) {
      if (!manifest.license.pricing) {
        return 'Paid plugins must include pricing information';
      }
      if (
        !manifest.license.pricing.price ||
        manifest.license.pricing.price <= 0
      ) {
        return 'Invalid pricing: price must be greater than 0';
      }
      if (!manifest.license.pricing.currency) {
        return 'Invalid pricing: currency is required';
      }
    }

    // Validate dependencies format
    if (manifest.dependencies) {
      for (const [depId, versionConstraint] of Object.entries(
        manifest.dependencies
      )) {
        // Validate dependency ID format
        if (!/^[a-z0-9-_]+$/i.test(depId)) {
          return `Invalid dependency ID format: ${depId}`;
        }

        // Validate version constraint (semver range)
        if (!semver.validRange(versionConstraint)) {
          return `Invalid version constraint for ${depId}: ${versionConstraint}`;
        }
      }
    }

    return null;
  }

  /**
   * Create an error plugin instance
   */
  private createErrorPlugin(
    manifest: Partial<PluginManifest>,
    error: string
  ): Plugin {
    return {
      manifest: {
        id: manifest.id || 'unknown',
        name: manifest.name || 'Unknown Plugin',
        version: manifest.version || '0.0.0',
        description: manifest.description || '',
        author: manifest.author || 'Unknown',
        main: manifest.main || 'index.js',
        permissions: manifest.permissions || [],
        license: manifest.license || { type: 'free', spdx: 'UNLICENSED' },
      },
      state: 'error',
      error,
      installedAt: new Date().toISOString(),
    };
  }

  /**
   * Load plugin code into a VM sandbox (activate).
   *
   * Plugins run in an isolated V8 context with no access to Node.js I/O APIs.
   * They receive the `context` object (passed by plugin-manager during activate)
   * as their only interaction surface.  A restricted `require` is provided that
   * allows relative imports within the plugin directory and a safe built-in
   * allowlist (path, util, os, url, querystring, events, stream, crypto).
   */
  async loadPluginCode(pluginId: string, pluginPath: string): Promise<any> {
    try {
      const plugin = this.loadedPlugins.get(pluginId);
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      const mainFile = path.join(
        pluginPath,
        plugin.manifest.main || 'index.js'
      );

      await fs.access(mainFile);

      const code = await fs.readFile(mainFile, 'utf8');
      const moduleCache = new Map<string, unknown>();
      const pluginModule = this.executeInSandbox(
        code,
        mainFile,
        pluginPath,
        moduleCache
      );

      this.sandboxCaches.set(pluginId, moduleCache);
      log.info(`[PluginLoader] Loaded plugin code for ${pluginId} (sandboxed)`);
      return pluginModule;
    } catch (error: unknown) {
      log.error(
        `[PluginLoader] Failed to load plugin code for ${pluginId}:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Unload plugin code (deactivate) — clears the sandbox module cache.
   */
  async unloadPluginCode(pluginId: string, _pluginPath: string): Promise<void> {
    try {
      this.sandboxCaches.delete(pluginId);
      log.info(`[PluginLoader] Unloaded plugin code for ${pluginId}`);
    } catch (error: unknown) {
      log.error(
        `[PluginLoader] Failed to unload plugin code for ${pluginId}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Execute plugin code in a sandboxed VM context.
   *
   * @param code     - Source code string (CommonJS JS)
   * @param filename - Absolute path used for stack traces and relative require resolution
   * @param pluginDir - Root directory of the plugin (require cannot escape above this)
   * @param moduleCache - Shared cache for this plugin's load session (handles circular requires)
   */
  private executeInSandbox(
    code: string,
    filename: string,
    pluginDir: string,
    moduleCache: Map<string, unknown>
  ): unknown {
    const moduleObj = { exports: {} as Record<string, unknown> };

    const sandboxedRequire = (specifier: string): unknown => {
      // Allow safe Node.js built-ins
      if (ALLOWED_BUILTINS.has(specifier)) {
        return require(specifier);
      }

      // Allow relative imports within the plugin directory
      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        const resolved = path.resolve(path.dirname(filename), specifier);

        // Block path traversal outside the plugin directory
        if (!resolved.startsWith(path.resolve(pluginDir))) {
          throw new Error(
            `[PluginSandbox] Path traversal blocked: "${specifier}"`
          );
        }

        // Try the path as-is, then with .js and /index.js suffixes
        const candidates = [
          resolved,
          `${resolved}.js`,
          path.join(resolved, 'index.js'),
        ];
        for (const candidate of candidates) {
          if (moduleCache.has(candidate)) {
            return moduleCache.get(candidate); // cycle protection
          }
          try {
            const childCode = readFileSync(candidate, 'utf8');
            moduleCache.set(candidate, {}); // reserve slot before recursing
            const childExports = this.executeInSandbox(
              childCode,
              candidate,
              pluginDir,
              moduleCache
            );
            moduleCache.set(candidate, childExports);
            return childExports;
          } catch {
            continue;
          }
        }
        throw new Error(`[PluginSandbox] Cannot find module: "${specifier}"`);
      }

      throw new Error(
        `[PluginSandbox] Module "${specifier}" is not allowed. ` +
          `Plugins may only import relative files or: ${[...ALLOWED_BUILTINS].join(', ')}`
      );
    };

    const context = vm.createContext({
      module: moduleObj,
      exports: moduleObj.exports,
      require: sandboxedRequire,
      __dirname: path.dirname(filename),
      __filename: filename,
      console,
      Buffer,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      setImmediate,
      clearImmediate,
      queueMicrotask,
      // Stripped-down process — no env, no exit, no spawn
      process: {
        platform: process.platform,
        version: process.version,
        versions: process.versions,
        env: {},
      },
    });

    const script = new vm.Script(code, { filename });
    script.runInContext(context, { timeout: 10_000 });

    return moduleObj.exports;
  }

  /**
   * Register a loaded plugin
   */
  registerPlugin(plugin: Plugin): void {
    this.loadedPlugins.set(plugin.manifest.id, plugin);
  }

  /**
   * Unregister a plugin
   */
  unregisterPlugin(pluginId: string): void {
    this.loadedPlugins.delete(pluginId);
  }

  /**
   * Get a loaded plugin
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.loadedPlugins.get(pluginId);
  }

  /**
   * Get all loaded plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Update plugin state
   */
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

  /**
   * Get plugin installation path by checking all configured directories
   */
  async getPluginPath(pluginId: string): Promise<string | null> {
    return await pathService.resolvePluginPath(pluginId);
  }
}

// Singleton instance
export const pluginLoader = new PluginLoader();
