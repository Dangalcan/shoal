/**
 * Plugin Watcher
 *
 * Watches plugin directories for file-system changes and triggers hot-reloads
 * via a debounced callback. Owns the watcher and timer state so PluginManager
 * doesn't have to.
 */

import fs from 'fs';
import { pluginLoader } from './plugin-loader';
import { getErrorMessage } from '../../utils/error-utils';
import log from '../../logger';

const DEBOUNCE_MS = 500;

export class PluginWatcher {
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private reloadTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /**
   * Start watching a plugin directory for changes.
   * @param onReload - Async callback invoked with the plugin ID after debounce.
   */
  async watch(
    pluginId: string,
    onReload: (pluginId: string) => Promise<void>
  ): Promise<void> {
    if (this.watchers.has(pluginId)) return;

    const pluginPath = await pluginLoader.getPluginPath(pluginId);
    if (!pluginPath) return;

    log.info(
      `[PluginWatcher] Starting watcher for ${pluginId} at ${pluginPath}`
    );

    try {
      const watcher = fs.watch(
        pluginPath,
        { recursive: true },
        (event, filename) => {
          log.info(
            `[PluginWatcher] Change detected in ${pluginId}: ${event} ${filename}`
          );

          const existing = this.reloadTimers.get(pluginId);
          if (existing) clearTimeout(existing);

          const timer = setTimeout(() => {
            this.reloadTimers.delete(pluginId);
            onReload(pluginId).catch((err: unknown) => {
              log.error(
                `[PluginWatcher] Auto-reload failed for ${pluginId}:`,
                getErrorMessage(err)
              );
            });
          }, DEBOUNCE_MS);

          this.reloadTimers.set(pluginId, timer);
        }
      );

      this.watchers.set(pluginId, watcher);
    } catch (error: unknown) {
      log.error(
        `[PluginWatcher] Failed to start watcher for ${pluginId}:`,
        getErrorMessage(error)
      );
    }
  }

  /** Stop watching a specific plugin. */
  stop(pluginId: string): void {
    const timer = this.reloadTimers.get(pluginId);
    if (timer) {
      clearTimeout(timer);
      this.reloadTimers.delete(pluginId);
    }

    const watcher = this.watchers.get(pluginId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(pluginId);
      log.info(`[PluginWatcher] Stopped watcher for ${pluginId}`);
    }
  }

  /** Stop all active watchers. */
  stopAll(): void {
    for (const id of [...this.watchers.keys()]) {
      this.stop(id);
    }
  }
}

export const pluginWatcher = new PluginWatcher();
