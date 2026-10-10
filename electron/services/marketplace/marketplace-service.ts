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
import semver from 'semver';
import { Result, MarketplaceEntry } from '../../types/plugin-types';
import {
  cleanupTempFile,
  extractZipSafe,
  verifyFileChecksum,
} from '../../utils/fs-utils';
import { getErrorMessage } from '../../utils/error-utils';
import { isProduction } from '../../utils/env-utils';
import { pluginManager } from '../plugins/plugin-manager';
import { assertValidPluginId } from '../plugins/plugin-validator';
import { pathService } from '../plugins/path-service';
import { machineIdSync } from 'node-machine-id';
import log from '../../logger';

export interface CheckoutSession {
  sessionId: string;
  url: string;
}

export interface CheckoutStatus {
  status: 'pending' | 'paid';
  licenseKey?: string;
}

export class MarketplaceService {
  private get BACKEND_URL(): string {
    return process.env.MARKETPLACE_BACKEND_URL ?? 'http://localhost:3001';
  }

  /** Fetch a URL with a timeout, returning the raw Response. */
  private fetchWithTimeout(url: string, timeoutMs = 10_000): Promise<Response> {
    return fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  }

  /** Fetch a URL, assert response.ok, and parse the body as JSON. */
  private async fetchJson<T>(url: string, timeoutMs = 10_000): Promise<T> {
    const response = await this.fetchWithTimeout(url, timeoutMs);
    if (!response.ok) {
      throw new Error(
        `Backend responded with ${response.status}: ${response.statusText}`
      );
    }
    return response.json() as Promise<T>;
  }

  /**
   * Get all active plugins from the marketplace backend.
   * Falls back to the local data file in development when the backend is unreachable.
   */
  async getMarketplacePlugins(): Promise<Result<MarketplaceEntry[]>> {
    try {
      const url = `${this.BACKEND_URL}/plugins`;
      log.info(`[MarketplaceService] Fetching plugins from ${url}`);

      const json = await this.fetchJson<
        { data: MarketplaceEntry[] } | MarketplaceEntry[]
      >(url);
      const data = Array.isArray(json) ? json : json.data;
      return { success: true, data };
    } catch (error: unknown) {
      if (isProduction()) {
        log.error(
          '[MarketplaceService] Failed to load plugins from backend:',
          error
        );
        return {
          success: false,
          error: `Could not reach marketplace backend: ${getErrorMessage(error)}`,
        };
      }

      // Development-only fallback: use the local data file
      log.warn(
        '[MarketplaceService] Backend unreachable, falling back to local marketplace.json (dev only):',
        getErrorMessage(error)
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
      const response = await this.fetchWithTimeout(url);

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
    } catch (error: unknown) {
      if (isProduction()) {
        log.error(
          `[MarketplaceService] Failed to fetch plugin details for ${pluginId}:`,
          error
        );
        return {
          success: false,
          error: getErrorMessage(error),
        };
      }

      // Development fallback: look up in local data
      log.warn(
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
  ): Promise<Result<unknown[]>> {
    if (installedPlugins.length === 0) return { success: true, data: [] };

    try {
      const ids = installedPlugins.map((p) => p.id).join(',');
      const versions = installedPlugins.map((p) => p.version).join(',');
      const url = `${this.BACKEND_URL}/plugins/check-updates?ids=${encodeURIComponent(ids)}&versions=${encodeURIComponent(versions)}`;

      const updates = await this.fetchJson<unknown[]>(url);
      return { success: true, data: updates };
    } catch (error: unknown) {
      if (isProduction()) {
        log.error('[MarketplaceService] Update check failed:', error);
        return {
          success: false,
          error: getErrorMessage(error),
        };
      }

      // Development fallback: compare against local data
      log.warn(
        '[MarketplaceService] Backend unreachable, falling back to local update check.'
      );
      const fallback = await this.loadLocalFallback();
      if (!fallback.success || !fallback.data)
        return { success: false, error: fallback.error };

      const updates: unknown[] = [];
      for (const installed of installedPlugins) {
        const latest = fallback.data.find((p) => p.id === installed.id);
        if (latest && this.isNewer(latest.version, installed.version)) {
          updates.push({
            pluginId: installed.id,
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
      // Guard against path traversal: pluginId becomes a directory name below.
      assertValidPluginId(pluginId);

      // 1. Get metadata
      const detailsResult = await this.getPluginDetails(pluginId);
      if (!detailsResult.success || !detailsResult.data) {
        throw new Error(
          detailsResult.error || 'Could not find plugin in marketplace'
        );
      }

      const plugin = detailsResult.data;
      log.info(
        `[MarketplaceService] Installing ${plugin.name} v${plugin.version}...`
      );

      // 2. Prepare install directory
      const pluginsDir = path.join(app.getPath('userData'), 'plugins');
      const pluginDir = path.join(pluginsDir, pluginId);
      await fs.rm(pluginDir, { recursive: true, force: true });

      if (plugin.downloadUrl.startsWith('local://')) {
        // Bundled plugin shipped with the app
        const sourcePath = path.join(
          pathService.getBundledPluginsDir(),
          pluginId
        );
        log.info(
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
        log.info(
          `[MarketplaceService] Copied bundled plugin "${pluginId}" to ${pluginDir}`
        );
      } else if (
        plugin.downloadUrl.startsWith('http://') ||
        plugin.downloadUrl.startsWith('https://')
      ) {
        // Full download from backend
        log.info(
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

        try {
          // Verify archive integrity before touching it. A checksum is
          // required in production; in dev a missing checksum is allowed
          // (local backend may not provide one yet).
          if (plugin.checksum) {
            await verifyFileChecksum(zipPath, plugin.checksum);
            log.info(
              `[MarketplaceService] Checksum verified for "${pluginId}"`
            );
          } else if (isProduction()) {
            throw new Error(
              `Refusing to install "${pluginId}": marketplace entry has no checksum.`
            );
          } else {
            log.warn(
              `[MarketplaceService] No checksum for "${pluginId}" (dev only) — skipping integrity check.`
            );
          }

          await fs.mkdir(pluginDir, { recursive: true });
          // Zip-slip-safe extraction (validates entries stay within pluginDir).
          await extractZipSafe(zipPath, pluginDir);
          log.info(`[MarketplaceService] Extracted plugin to ${pluginDir}`);
        } finally {
          await cleanupTempFile(zipPath, '[MarketplaceService] plugin zip');
        }
      } else {
        throw new Error(
          `Unsupported download URL scheme for plugin "${pluginId}". Expected local:// or http(s)://`
        );
      }

      // 3. Refresh discovery to register the new plugin
      await pluginManager.refreshDiscovery(pluginId);
      return { success: true };
    } catch (error: unknown) {
      log.error('[MarketplaceService] Installation failed:', error);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Start a purchase for a paid plugin. Returns a Checkout URL the user opens
   * to pay, plus a sessionId to poll with getCheckoutStatus.
   */
  async createCheckout(pluginId: string): Promise<Result<CheckoutSession>> {
    try {
      assertValidPluginId(pluginId);
      const response = await fetch(`${this.BACKEND_URL}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId, machineId: machineIdSync() }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        const err = await response
          .json()
          .catch(() => ({ error: `HTTP ${response.status}` }));
        return {
          success: false,
          error: err.error || `HTTP ${response.status}`,
        };
      }
      return {
        success: true,
        data: (await response.json()) as CheckoutSession,
      };
    } catch (error: unknown) {
      log.error('[MarketplaceService] createCheckout failed:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Poll a checkout session. Once `status` is 'paid', `licenseKey` holds the
   * purchased key to activate + install.
   */
  async getCheckoutStatus(sessionId: string): Promise<Result<CheckoutStatus>> {
    try {
      const url = `${this.BACKEND_URL}/checkout/${encodeURIComponent(sessionId)}`;
      const response = await this.fetchWithTimeout(url);
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      return { success: true, data: (await response.json()) as CheckoutStatus };
    } catch (error: unknown) {
      return { success: false, error: getErrorMessage(error) };
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
    } catch (err: unknown) {
      return {
        success: false,
        error: `Failed to load local fallback: ${getErrorMessage(err)}`,
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
