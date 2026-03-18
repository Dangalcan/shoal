/**
 * Plugin Registry
 *
 * Manages plugin state, configuration, and persistence.
 * Tracks enabled/disabled plugins and their settings.
 */

import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import type {
  Plugin,
  PluginConfig,
  PluginContext,
  PluginRegistryEntry,
} from '../../types/plugin-types';
import { encrypt, decrypt } from '../security/encryption-utils';
import { getErrorMessage } from '../../utils/error-utils';
import log from '../../logger';

export class PluginRegistry {
  private registry: Map<string, PluginRegistryEntry> = new Map();
  private configCache: Record<string, PluginConfig> = {};
  private configFilePath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configFilePath = path.join(userDataPath, 'plugin-config.json');
  }

  /**
   * Initialize registry and load saved configuration
   */
  async initialize(): Promise<void> {
    try {
      await this.loadConfiguration();
      log.info(
        '[PluginRegistry] Initialized with',
        this.registry.size,
        'plugins'
      );
    } catch (error: unknown) {
      log.error(
        '[PluginRegistry] Failed to initialize:',
        getErrorMessage(error)
      );
    }
  }

  /**
   * Load plugin configuration from disk
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configFilePath, 'utf-8');
      const loadedConfig = JSON.parse(configData);

      // Decrypt sensitive data
      for (const pluginId in loadedConfig) {
        const config = loadedConfig[pluginId];
        if (config.licenseInfo?.licenseKey) {
          config.licenseInfo.licenseKey = decrypt(
            config.licenseInfo.licenseKey
          );
        }
      }

      this.configCache = loadedConfig;
      log.info(
        '[PluginRegistry] Loaded configuration for',
        Object.keys(this.configCache).length,
        'plugins'
      );
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        log.error(
          '[PluginRegistry] Error loading configuration:',
          getErrorMessage(error)
        );
      }
    }
  }

  /**
   * Save plugin configuration to disk
   */
  async saveConfiguration(): Promise<void> {
    try {
      const configToSave: Record<string, PluginConfig> = JSON.parse(
        JSON.stringify(this.configCache)
      );

      for (const [pluginId, entry] of this.registry.entries()) {
        configToSave[pluginId] = entry.config;
      }

      // Encrypt sensitive data
      for (const pluginId in configToSave) {
        const config = configToSave[pluginId];
        if (config.licenseInfo?.licenseKey) {
          config.licenseInfo.licenseKey = encrypt(
            config.licenseInfo.licenseKey
          );
        }
      }

      await fs.writeFile(
        this.configFilePath,
        JSON.stringify(configToSave, null, 2),
        'utf-8'
      );

      log.info(
        '[PluginRegistry] Saved configuration for',
        Object.keys(configToSave).length,
        'plugins'
      );
    } catch (error: unknown) {
      log.error(
        '[PluginRegistry] Failed to save configuration:',
        getErrorMessage(error)
      );
      throw error;
    }
  }

  /**
   * Register a plugin
   */
  async registerPlugin(plugin: Plugin, config?: PluginConfig): Promise<void> {
    const pluginId = plugin.manifest.id;

    // Load existing config if available
    let pluginConfig = config;
    if (!pluginConfig) {
      pluginConfig = (await this.getPluginConfig(pluginId)) || {
        enabled: false,
        settings: {},
      };
    }

    // Sync license info to plugin instance
    if (pluginConfig.licenseInfo) {
      plugin.licenseInfo = pluginConfig.licenseInfo;
    }

    const entry: PluginRegistryEntry = {
      plugin,
      config: pluginConfig,
    };

    this.registry.set(pluginId, entry);
    await this.saveConfiguration();

    log.info(
      `[PluginRegistry] Registered plugin: ${plugin.manifest.name} (${pluginId})`
    );
  }

  /**
   * Unregister a plugin
   */
  async unregisterPlugin(pluginId: string): Promise<void> {
    this.registry.delete(pluginId);
    await this.saveConfiguration();

    log.info(`[PluginRegistry] Unregistered plugin: ${pluginId}`);
  }

  /**
   * Get plugin entry
   */
  getPlugin(pluginId: string): PluginRegistryEntry | undefined {
    return this.registry.get(pluginId);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.registry.values()).map((entry) => entry.plugin);
  }

  /**
   * Get enabled plugins only
   */
  getEnabledPlugins(): Plugin[] {
    return Array.from(this.registry.values())
      .filter((entry) => entry.config.enabled)
      .map((entry) => entry.plugin);
  }

  /**
   * Get plugin configuration
   */
  async getPluginConfig(pluginId: string): Promise<PluginConfig | null> {
    return this.configCache[pluginId] || null;
  }

  /**
   * Update plugin configuration
   */
  async updatePluginConfig(
    pluginId: string,
    config: Partial<PluginConfig>
  ): Promise<void> {
    const entry = this.registry.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin ${pluginId} not found in registry`);
    }

    entry.config = {
      ...entry.config,
      ...config,
    };

    // Sync license info if present
    if (config.licenseInfo) {
      entry.plugin.licenseInfo = config.licenseInfo;
    }

    await this.saveConfiguration();
    log.info(`[PluginRegistry] Updated config for ${pluginId}`);
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(pluginId: string): Promise<void> {
    await this.updatePluginConfig(pluginId, { enabled: true });
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginId: string): Promise<void> {
    await this.updatePluginConfig(pluginId, { enabled: false });
  }

  /**
   * Check if plugin is enabled
   */
  isPluginEnabled(pluginId: string): boolean {
    const entry = this.registry.get(pluginId);
    return entry?.config.enabled || false;
  }

  /**
   * Update plugin settings
   */
  async updatePluginSettings(
    pluginId: string,
    settings: Record<string, unknown>
  ): Promise<void> {
    const entry = this.registry.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin ${pluginId} not found in registry`);
    }

    entry.config.settings = {
      ...entry.config.settings,
      ...settings,
    };

    await this.saveConfiguration();
    log.info(`[PluginRegistry] Updated settings for ${pluginId}`);
  }

  /**
   * Get plugin settings
   */
  getPluginSettings(pluginId: string): Record<string, unknown> {
    const entry = this.registry.get(pluginId);
    return entry?.config.settings || {};
  }

  /**
   * Set plugin context (after activation)
   */
  setPluginContext(pluginId: string, context: unknown): void {
    const entry = this.registry.get(pluginId);
    if (entry) {
      entry.context = context as PluginContext;
    }
  }

  /**
   * Get plugin context
   */
  getPluginContext(pluginId: string): unknown {
    const entry = this.registry.get(pluginId);
    return entry?.context;
  }

  /**
   * Clear plugin context (on deactivation)
   */
  clearPluginContext(pluginId: string): void {
    const entry = this.registry.get(pluginId);
    if (entry) {
      delete entry.context;
    }
  }

  /**
   * Check if plugin exists
   */
  hasPlugin(pluginId: string): boolean {
    return this.registry.has(pluginId);
  }

  /**
   * Get plugin count
   */
  getPluginCount(): number {
    return this.registry.size;
  }

  /**
   * Clear all plugins (for testing)
   */
  clear(): void {
    this.registry.clear();
  }
}

// Singleton instance
export const pluginRegistry = new PluginRegistry();
