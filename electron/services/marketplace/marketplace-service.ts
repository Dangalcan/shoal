/**
 * Marketplace Service
 *
 * Communicates with the external marketplace backend to discover and install plugins.
 */

import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { app } from 'electron';
import AdmZip from 'adm-zip';
import { Result, MarketplaceEntry } from '../../types/plugin-types';
import { pluginManager } from '../plugins/plugin-manager';

export class MarketplaceService {
  /**
   * Get all active plugins from the marketplace
   */
  async getMarketplacePlugins(): Promise<Result<MarketplaceEntry[]>> {
    try {
      console.log(
        `[MarketplaceService] loading plugins from local marketplace data`
      );
      const plugins = await this.loadLocalMarketplaceData();
      return { success: true, data: plugins };
    } catch (error: any) {
      console.error('[MarketplaceService] Failed to load plugins:', error);
      return {
        success: false,
        error: error.message || 'Failed to load local marketplace',
      };
    }
  }

  /**
   * Get detailed info for a specific plugin
   */
  async getPluginDetails(pluginId: string): Promise<Result<MarketplaceEntry>> {
    try {
      const plugins = await this.loadLocalMarketplaceData();
      const plugin = plugins.find((p: MarketplaceEntry) => p.id === pluginId);

      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found in marketplace`);
      }

      return { success: true, data: plugin };
    } catch (error: any) {
      console.error(
        `[MarketplaceService] Failed to fetch plugin details for ${pluginId}:`,
        error
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Check for updates for a list of installed plugins
   */
  async checkForUpdates(
    installedPlugins: { id: string; version: string }[]
  ): Promise<Result<any[]>> {
    if (installedPlugins.length === 0) return { success: true, data: [] };

    try {
      const marketplacePlugins = await this.loadLocalMarketplaceData();
      const updates: any[] = [];

      for (const installed of installedPlugins) {
        const latest = marketplacePlugins.find(
          (p: MarketplaceEntry) => p.id === installed.id
        );
        if (latest && this.isNewer(latest.version, installed.version)) {
          updates.push({
            id: installed.id,
            version: latest.version,
            description: latest.description,
            downloadUrl: latest.downloadUrl,
          });
        }
      }

      return { success: true, data: updates };
    } catch (error: any) {
      console.error('[MarketplaceService] Update check failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Install/Update a plugin from the marketplace
   */
  async installPlugin(pluginId: string): Promise<Result<void>> {
    try {
      // 1. Get metadata
      const detailsResult = await this.getPluginDetails(pluginId);
      if (!detailsResult.success || !detailsResult.data) {
        throw new Error(
          detailsResult.error || 'Could not find plugin in marketplace'
        );
      }

      const plugin = detailsResult.data;
      if (!plugin.manifest) {
        throw new Error(
          `Plugin ${pluginId} missing manifest in marketplace data`
        );
      }

      console.log(
        `[MarketplaceService] Installing ${plugin.name} v${plugin.version}...`
      );

      // 2. Prepare paths
      const pluginsDir = path.join(app.getPath('userData'), 'plugins');
      const pluginDir = path.join(pluginsDir, pluginId);

      // Ensure clean install directory
      await fs.rm(pluginDir, { recursive: true, force: true });

      if (plugin.downloadUrl.startsWith('local://')) {
        // Local simulation: copy from the bundled plugins directory
        console.log(
          '[MarketplaceService] Installing from local source for',
          pluginId
        );
        const sourcePath = path.join(app.getAppPath(), 'plugins', pluginId);
        let copied = false;

        try {
          await fs.access(sourcePath);
          await fs.mkdir(pluginDir, { recursive: true });
          if (fs.cp) {
            await fs.cp(sourcePath, pluginDir, { recursive: true });
            console.log(
              `[MarketplaceService] Copied local plugin from ${sourcePath}`
            );
            copied = true;
          }
        } catch (e) {
          console.warn(
            `[MarketplaceService] Source ${sourcePath} not accessible or copy failed, writing dummy files`
          );
        }

        if (!copied) {
          await fs.mkdir(pluginDir, { recursive: true });
          await fs.writeFile(
            path.join(pluginDir, 'plugin.json'),
            JSON.stringify(plugin.manifest, null, 2)
          );
          const mainFile = plugin.manifest.main || 'index.js';
          const mainPath = path.join(pluginDir, mainFile);
          await fs.mkdir(path.dirname(mainPath), { recursive: true });
          await fs.writeFile(mainPath, 'module.exports = {}');
          if (plugin.manifest.renderer) {
            const rendererPath = path.join(pluginDir, plugin.manifest.renderer);
            await fs.mkdir(path.dirname(rendererPath), { recursive: true });
            await fs.writeFile(rendererPath, 'console.log("Renderer loaded")');
          }
        }
      } else if (
        plugin.downloadUrl.startsWith('http://') ||
        plugin.downloadUrl.startsWith('https://')
      ) {
        // Real HTTP download
        console.log(
          `[MarketplaceService] Downloading ${plugin.name} from ${plugin.downloadUrl}`
        );
        const response = await fetch(plugin.downloadUrl);
        if (!response.ok || !response.body) {
          throw new Error(
            `Download failed: ${response.status} ${response.statusText}`
          );
        }
        const zipPath = path.join(
          app.getPath('temp'),
          `${pluginId}-${plugin.version}.zip`
        );
        const fileStream = createWriteStream(zipPath);
        await pipeline(response.body as any, fileStream);

        await fs.mkdir(pluginDir, { recursive: true });
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(pluginDir, true);
        await fs.unlink(zipPath).catch(() => {});
        console.log(`[MarketplaceService] Extracted plugin to ${pluginDir}`);
      } else {
        throw new Error(
          `Unsupported download URL scheme for plugin "${pluginId}". Expected local:// or http(s)://`
        );
      }

      // 6. Refresh discovery to register the new plugin
      await pluginManager.refreshDiscovery(pluginId);

      return { success: true };
    } catch (error: any) {
      console.error('[MarketplaceService] Installation failed:', error);
      return { success: false, error: error.message || 'Installation failed' };
    }
  }

  private async loadLocalMarketplaceData(): Promise<MarketplaceEntry[]> {
    // In packaged builds app.getAppPath() points inside the asar archive where fs reads work,
    // but the data dir is copied alongside it under process.resourcesPath.
    const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
    const dataPath = path.join(basePath, 'electron/data/marketplace.json');
    const raw = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(raw);
  }

  /**
   * Helper to compare versions
   */
  isNewer(latest: string, current: string): boolean {
    const l = latest.split('.').map(Number);
    const c = current.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const lVal = l[i] ?? 0;
      const cVal = c[i] ?? 0;
      if (lVal > cVal) return true;
      if (lVal < cVal) return false;
    }
    return false;
  }
}

export const marketplaceService = new MarketplaceService();
