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

const MARKETPLACE_API_URL = 'http://localhost:3001';

export class MarketplaceService {
  /**
   * Get all active plugins from the marketplace
   */
  async getMarketplacePlugins(): Promise<Result<MarketplaceEntry[]>> {
    try {
      console.log(
        `[MarketplaceService] Fetching plugins from ${MARKETPLACE_API_URL}/plugins`
      );
      const response = await fetch(`${MARKETPLACE_API_URL}/plugins`);

      if (!response.ok) {
        throw new Error(`Marketplace API error: ${response.statusText}`);
      }

      const plugins = (await response.json()) as MarketplaceEntry[];
      return { success: true, data: plugins };
    } catch (error: any) {
      console.error('[MarketplaceService] Failed to fetch plugins:', error);
      return {
        success: false,
        error: error.message || 'Failed to connect to marketplace',
      };
    }
  }

  /**
   * Get detailed info for a specific plugin
   */
  async getPluginDetails(pluginId: string): Promise<Result<MarketplaceEntry>> {
    try {
      const response = await fetch(
        `${MARKETPLACE_API_URL}/plugins/${pluginId}`
      );

      if (!response.ok) {
        throw new Error(`Plugin ${pluginId} not found in marketplace`);
      }

      const plugin = (await response.json()) as MarketplaceEntry;
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
      const ids = installedPlugins.map((p) => p.id).join(',');
      const versions = installedPlugins.map((p) => p.version).join(',');

      console.log(`[MarketplaceService] Checking updates for: ${ids}`);
      const response = await fetch(
        `${MARKETPLACE_API_URL}/plugins/check-updates?ids=${ids}&versions=${versions}`
      );

      if (!response.ok) {
        throw new Error('Failed to check for updates');
      }

      const updates = (await response.json()) as any[];
      return { success: true, data: updates };
    } catch (error: any) {
      console.error('[MarketplaceService] Update check failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Install/Update a plugin from the marketplace
   */
  /**
   * Install/Update a plugin from the marketplace
   */
  async installPlugin(pluginId: string): Promise<Result<void>> {
    try {
      // 1. Get metadata from backend
      const detailsResult = await this.getPluginDetails(pluginId);
      if (!detailsResult.success || !detailsResult.data) {
        throw new Error(
          detailsResult.error || 'Could not find plugin in marketplace'
        );
      }

      const plugin = detailsResult.data;
      console.log(
        `[MarketplaceService] Installing ${plugin.name} v${plugin.version}...`
      );

      // 2. Prepare paths
      const pluginsDir = path.join(app.getPath('userData'), 'plugins');
      const pluginDir = path.join(pluginsDir, pluginId);
      const tempDir = app.getPath('temp');
      const downloadPath = path.join(
        tempDir,
        `${pluginId}-${plugin.version}.zip`
      );

      // 3. Download the plugin artifact
      await this.downloadPlugin(plugin.downloadUrl, downloadPath);

      // 4. Extract/Install the plugin
      await this.extractPlugin(downloadPath, pluginDir, plugin);

      // 5. Cleanup
      await fs.unlink(downloadPath).catch(() => {});

      // 6. Refresh discovery to register the new plugin
      await pluginManager.refreshDiscovery(pluginId);

      return { success: true };
    } catch (error: any) {
      console.error('[MarketplaceService] Installation failed:', error);
      return { success: false, error: error.message || 'Installation failed' };
    }
  }

  /**
   * Download the plugin artifact
   */
  private async downloadPlugin(url: string, destPath: string): Promise<void> {
    console.log(`[MarketplaceService] Downloading from ${url} to ${destPath}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download plugin: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Download response has no body');
    }

    // @ts-ignore - ReadableStream/Node stream compatibility
    await pipeline(response.body, createWriteStream(destPath));
  }

  /**
   * Extract the plugin artifact using adm-zip
   */
  private async extractPlugin(
    archivePath: string,
    destPath: string,
    metadata: MarketplaceEntry
  ): Promise<void> {
    console.log(
      `[MarketplaceService] Extracting ${archivePath} to ${destPath}`
    );

    // Ensure directory exists
    await fs.mkdir(destPath, { recursive: true });

    const zip = new AdmZip(archivePath);
    zip.extractAllTo(destPath, true);

    console.log(
      `[MarketplaceService] Extracted ${metadata.name} to ${destPath}`
    );
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
