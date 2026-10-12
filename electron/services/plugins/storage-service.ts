/**
 * Storage Service
 *
 * Provides a robust SQLite-backed key-value store for plugins.
 * Handles migration from legacy JSON storage.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs/promises';
import { pathService } from './path-service';
import { getErrorMessage } from '../../utils/error-utils';
import log from '../../logger';
import { tildify } from '../../utils/tildify';

export class StorageService {
  private db: Database.Database | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    if (this.db) return;

    const userData = app.getPath('userData');
    const dbPath = path.join(userData, 'plugins_storage.db');

    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS plugin_kv (
        plugin_id TEXT,
        key TEXT,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (plugin_id, key)
      )
    `);

    log.info(
      '[StorageService] Plugin storage database initialized at',
      tildify(dbPath)
    );
  }

  /**
   * Get a value from storage
   */
  get(pluginId: string, key: string): unknown {
    const row = this.db!.prepare(
      'SELECT value FROM plugin_kv WHERE plugin_id = ? AND key = ?'
    ).get(pluginId, key) as { value: string } | undefined;

    if (!row) return null;

    try {
      return JSON.parse(row.value);
    } catch (e) {
      log.error(
        `[StorageService] Failed to parse value for ${pluginId}:${key}`
      );
      return null;
    }
  }

  /**
   * Set a value in storage
   */
  set(pluginId: string, key: string, value: unknown): void {
    const valueStr = JSON.stringify(value);
    this.db!.prepare(
      `
      INSERT INTO plugin_kv (plugin_id, key, value, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(plugin_id, key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `
    ).run(pluginId, key, valueStr);
  }

  /**
   * Delete a key from storage
   */
  delete(pluginId: string, key: string): void {
    this.db!.prepare(
      'DELETE FROM plugin_kv WHERE plugin_id = ? AND key = ?'
    ).run(pluginId, key);
  }

  /**
   * Clear all storage for a plugin
   */
  clear(pluginId: string): void {
    this.db!.prepare('DELETE FROM plugin_kv WHERE plugin_id = ?').run(pluginId);
  }

  /**
   * Get a specific key across all plugins (returns a Map of pluginId -> value)
   */
  getAllByKey(key: string): Map<string, unknown> {
    const rows = this.db!.prepare(
      'SELECT plugin_id, value FROM plugin_kv WHERE key = ?'
    ).all(key) as { plugin_id: string; value: string }[];

    const result = new Map<string, unknown>();
    for (const row of rows) {
      try {
        result.set(row.plugin_id, JSON.parse(row.value));
      } catch (e) {
        log.error(
          `[StorageService] Failed to parse value for ${row.plugin_id}:${key}`
        );
      }
    }
    return result;
  }

  /**
   * Migrate legacy JSON storage to SQLite
   */
  async migrateFromJson(pluginId: string): Promise<void> {
    const storagePath = pathService.getPluginStorageDir(pluginId);

    try {
      const files = await fs.readdir(storagePath);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      if (jsonFiles.length === 0) return;

      log.info(
        `[StorageService] Migrating ${jsonFiles.length} keys for ${pluginId}...`
      );

      for (const file of jsonFiles) {
        const key = path.basename(file, '.json');
        try {
          const filePath = path.join(storagePath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const value = JSON.parse(content);

          this.set(pluginId, key, value);

          // Rename the file to .json.bak instead of deleting immediately for safety
          await fs.rename(filePath, `${filePath}.bak`);
        } catch (e: unknown) {
          const msg = getErrorMessage(e);
          log.error(
            `[StorageService] Migration failed for ${pluginId}:${file}`,
            msg
          );
        }
      }

      log.info(`[StorageService] Migration completed for ${pluginId}`);
    } catch (error: unknown) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== 'ENOENT') {
        const msg = getErrorMessage(error);
        log.error(`[StorageService] Migration error for ${pluginId}:`, msg);
      }
    }
  }
}

export const storageService = new StorageService();
