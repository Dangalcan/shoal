/**
 * Marketplace Service
 *
 * Communicates with the marketplace backend API to discover and install plugins.
 * Falls back to the local marketplace.json in development when the backend is unreachable.
 */

import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { app } from 'electron';
import AdmZip from 'adm-zip';
import semver from 'semver';
import { Result, MarketplaceEntry } from '../../types/plugin-types';
import { pluginManager } from '../plugins/plugin-manager';

export class MarketplaceService {
  private get BACKEND_URL(): string {
    return process.env.MARKETPLACE_BACKEND_URL ?? 'http://localhost:3001';
  }

  /**
   * Get all active plugins from the marketplace backend.
   * Falls back to the local data file in development when the backend is unreachable.
   */
  async getMarketplacePlugins(): Promise<Result<MarketplaceEntry[]>> {
    try {
      const url = `${this.BACKEND_URL}/plugins`;
      console.log(`[MarketplaceService] Fetching plugins from ${url}`);

      const response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(
          `Backend responded with ${response.status}: ${response.statusText}`
        );
      }

      const json = (await response.json()) as
        | { data: MarketplaceEntry[] }
        | MarketplaceEntry[];
      const data = Array.isArray(json) ? json : json.data;
      return { success: true, data };
    } catch (error: any) {
      if (app?.isPackaged) {
        console.error(
          '[MarketplaceService] Failed to load plugins from backend:',
          error
        );
        return {
          success: false,
          error: `Could not reach marketplace backend: ${error.message}`,
        };
      }

      // Development-only fallback: use the local data file
      console.warn(
        '[MarketplaceService] Backend unreachable, falling back to local marketplace.json (dev only):',
        error.message
      );
      return this.loadLocalFallback();
    }
  }

  /**
   * Get detailed info for a specific plugin from the backend.
   */
  async getPluginDetails(pluginId: string): Promise<Result<MarketplaceEntry>> {
    try {
      const url = `${this.BACKEND_URL}/plugins/${encodeURIComponent(pluginId)}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });

      if (response.status === 404) {
        return {
          success: false,
          error: `Plugin "${pluginId}" not found in marketplace`,
        };
      }
      if (!response.ok) {
        throw new Error(
          `Backend responded with ${response.status}: ${response.statusText}`
        );
      }

      const data = (await response.json()) as MarketplaceEntry;
      return { success: true, data };
    } catch (error: any) {
      if (app?.isPackaged) {
        console.error(
          `[MarketplaceService] Failed to fetch plugin details for ${pluginId}:`,
          error
        );
        return { success: false, error: error.message };
      }

      // Development fallback: look up in local data
      console.warn(
        '[MarketplaceService] Backend unreachable, using local fallback for details.'
      );
      const fallback = await this.loadLocalFallback();
      if (!fallback.success || !fallback.data)
        return { success: false, error: fallback.error };
      const plugin = fallback.data.find((p) => p.id === pluginId);
      if (!plugin)
        return {
          success: false,
          error: `Plugin "${pluginId}" not found in marketplace`,
        };
      return { success: true, data: plugin };
    }
  }

  /**
   * Check for updates for a list of installed plugins.
   */
  async checkForUpdates(
    installedPlugins: { id: string; version: string }[]
  ): Promise<Result<any[]>> {
    if (installedPlugins.length === 0) return { success: true, data: [] };

    try {
      const ids = installedPlugins.map((p) => p.id).join(',');
      const versions = installedPlugins.map((p) => p.version).join(',');
      const url = `${this.BACKEND_URL}/plugins/check-updates?ids=${encodeURIComponent(ids)}&versions=${encodeURIComponent(versions)}`;

      const response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(
          `Backend responded with ${response.status}: ${response.statusText}`
        );
      }

      const updates = await response.json();
      return { success: true, data: updates };
    } catch (error: any) {
      if (app?.isPackaged) {
        console.error('[MarketplaceService] Update check failed:', error);
        return { success: false, error: error.message };
      }

      // Development fallback: compare against local data
      console.warn(
        '[MarketplaceService] Backend unreachable, falling back to local update check.'
      );
      const fallback = await this.loadLocalFallback();
      if (!fallback.success || !fallback.data)
        return { success: false, error: fallback.error };

      const updates: any[] = [];
      for (const installed of installedPlugins) {
        const latest = fallback.data.find((p) => p.id === installed.id);
        if (latest && this.isNewer(latest.version, installed.version)) {
          updates.push({
            id: installed.id,
            latestVersion: latest.version,
            hasUpdate: true,
          });
        }
      }
      return { success: true, data: updates };
    }
  }

  /**
   * Install/Update a plugin from the marketplace.
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
      console.log(
        `[MarketplaceService] Installing ${plugin.name} v${plugin.version}...`
      );

      // 2. Prepare install directory
      const pluginsDir = path.join(app.getPath('userData'), 'plugins');
      const pluginDir = path.join(pluginsDir, pluginId);
      await fs.rm(pluginDir, { recursive: true, force: true });

      if (plugin.downloadUrl.startsWith('local://')) {
        // Bundled plugin shipped with the app
        const sourcePath = path.join(app.getAppPath(), 'plugins', pluginId);
        console.log(
          `[MarketplaceService] Installing "${pluginId}" from bundled source: ${sourcePath}`
        );

        try {
          await fs.access(sourcePath);
        } catch {
          throw new Error(
            `Bundled plugin source not found at: ${sourcePath}. ` +
              'Ensure the plugin is included in the application bundle.'
          );
        }

        await fs.mkdir(pluginDir, { recursive: true });
        await fs.cp(sourcePath, pluginDir, { recursive: true });
        console.log(
          `[MarketplaceService] Copied bundled plugin "${pluginId}" to ${pluginDir}`
        );
      } else if (
        plugin.downloadUrl.startsWith('http://') ||
        plugin.downloadUrl.startsWith('https://')
      ) {
        // Full download from backend
        console.log(
          `[MarketplaceService] Downloading ${plugin.name} from ${plugin.downloadUrl}`
        );
        const response = await fetch(plugin.downloadUrl, {
          signal: AbortSignal.timeout(60_000),
        });
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
        await fs
          .unlink(zipPath)
          .catch((e: any) =>
            console.warn(
              `[MarketplaceService] Failed to delete temp zip "${zipPath}":`,
              e.message
            )
          );
        console.log(`[MarketplaceService] Extracted plugin to ${pluginDir}`);
      } else {
        throw new Error(
          `Unsupported download URL scheme for plugin "${pluginId}". Expected local:// or http(s)://`
        );
      }

      // 3. Refresh discovery to register the new plugin
      await pluginManager.refreshDiscovery(pluginId);
      return { success: true };
    } catch (error: any) {
      console.error('[MarketplaceService] Installation failed:', error);
      return { success: false, error: error.message || 'Installation failed' };
    }
  }

  /**
   * Development-only fallback: read from the bundled local marketplace.json.
   * Never used in packaged (production) builds.
   */
  private async loadLocalFallback(): Promise<Result<MarketplaceEntry[]>> {
    try {
      const dataPath = path.join(
        app.getAppPath(),
        'electron/data/marketplace.json'
      );
      const raw = await fs.readFile(dataPath, 'utf-8');
      return { success: true, data: JSON.parse(raw) };
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to load local fallback: ${err.message}`,
      };
    }
  }

  isNewer(latest: string, current: string): boolean {
    const l = semver.coerce(latest);
    const c = semver.coerce(current);
    if (!l || !c) return false;
    return semver.gt(l, c);
  }
}

export const marketplaceService = new MarketplaceService();
