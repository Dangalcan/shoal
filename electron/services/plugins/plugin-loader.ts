/**
 * Plugin Loader
 *
 * Responsible for discovering, loading, and managing plugins in the main process.
 * Handles plugin lifecycle, validation, and security.
 */

import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import semver from 'semver';
import type {
  PluginManifest,
  Plugin,
  PluginState,
} from '../../types/plugin-types';
import { signatureService } from '../security/signature-service';

export class PluginLoader {
  private pluginDirectories: string[] = [];
  private loadedPlugins: Map<string, Plugin> = new Map();

  constructor() {
    this.initializePluginDirectories();
  }

  /**
   * Initialize plugin discovery directories
   */
  private initializePluginDirectories(): void {
    const userDataPath = app.getPath('userData');

    this.pluginDirectories = [
      // User-installed plugins
      path.join(userDataPath, 'plugins'),
      // Bundled plugins (in app directory)
      path.join(app.getAppPath(), 'plugins'),
    ];

    console.log('[PluginLoader] Plugin directories:', this.pluginDirectories);
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
      } catch (error: any) {
        // Directory doesn't exist or can't be read - this is okay
        console.log(`[PluginLoader] Directory not accessible: ${directory}`);
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
        console.error(
          `[PluginLoader] Invalid manifest for ${pluginPath}:`,
          validationError
        );
        return this.createErrorPlugin(manifest, validationError);
      }

      // Verify signature
      const isVerified = await signatureService.verifyPlugin(pluginPath);
      if (!isVerified) {
        console.error(
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
          console.warn(
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
            console.warn(
              `[PluginLoader] Style entry not found for ${manifest.id}: ${fullStylePath}`
            );
          }
        }
      }

      console.log(
        `[PluginLoader] Discovered plugin: ${manifest.name} (${manifest.id})`
      );
      return plugin;
    } catch (error: any) {
      console.error(
        `[PluginLoader] Failed to load plugin from ${pluginPath}:`,
        error.message
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
   * Load plugin code (activate)
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

      // Check if file exists
      await fs.access(mainFile);

      // Load the plugin module
      // Note: Using require for now, but should implement proper sandboxing
      const pluginModule = require(mainFile);

      return pluginModule;
    } catch (error: any) {
      console.error(
        `[PluginLoader] Failed to load plugin code for ${pluginId}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Unload plugin code (deactivate)
   */
  async unloadPluginCode(pluginId: string, pluginPath: string): Promise<void> {
    try {
      const plugin = this.loadedPlugins.get(pluginId);
      if (!plugin) {
        return;
      }

      const mainFile = path.join(
        pluginPath,
        plugin.manifest.main || 'index.js'
      );

      // Remove from require cache
      delete require.cache[require.resolve(mainFile)];

      console.log(`[PluginLoader] Unloaded plugin code for ${pluginId}`);
    } catch (error: any) {
      console.error(
        `[PluginLoader] Failed to unload plugin code for ${pluginId}:`,
        error.message
      );
    }
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
    for (const directory of this.pluginDirectories) {
      const pluginPath = path.join(directory, pluginId);
      try {
        await fs.access(pluginPath);
        return pluginPath;
      } catch {
        // Continue to next directory if not found
        continue;
      }
    }
    return null;
  }
}

// Singleton instance
export const pluginLoader = new PluginLoader();
