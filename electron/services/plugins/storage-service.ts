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

    console.log('[StorageService] Plugin storage database initialized at', dbPath);
  }

  /**
   * Get a value from storage
   */
  get(pluginId: string, key: string): any {
    const row = this.db!.prepare(
      'SELECT value FROM plugin_kv WHERE plugin_id = ? AND key = ?'
    ).get(pluginId, key) as { value: string } | undefined;

    if (!row) return null;

    try {
      return JSON.parse(row.value);
    } catch (e) {
      console.error(`[StorageService] Failed to parse value for ${pluginId}:${key}`);
      return null;
    }
  }

  /**
   * Set a value in storage
   */
  set(pluginId: string, key: string, value: any): void {
    const valueStr = JSON.stringify(value);
    this.db!.prepare(`
      INSERT INTO plugin_kv (plugin_id, key, value, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(plugin_id, key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).run(pluginId, key, valueStr);
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
    this.db!.prepare(
      'DELETE FROM plugin_kv WHERE plugin_id = ?'
    ).run(pluginId);
  }

  /**
   * Migrate legacy JSON storage to SQLite
   */
  async migrateFromJson(pluginId: string): Promise<void> {
    const storagePath = pathService.getPluginStorageDir(pluginId);
    
    try {
      const files = await fs.readdir(storagePath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) return;

      console.log(`[StorageService] Migrating ${jsonFiles.length} keys for ${pluginId}...`);

      for (const file of jsonFiles) {
        const key = path.basename(file, '.json');
        try {
          const filePath = path.join(storagePath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const value = JSON.parse(content);
          
          this.set(pluginId, key, value);
          
          // Rename the file to .json.bak instead of deleting immediately for safety
          await fs.rename(filePath, `${filePath}.bak`);
        } catch (e: any) {
          console.error(`[StorageService] Migration failed for ${pluginId}:${file}`, e.message);
        }
      }
      
      console.log(`[StorageService] Migration completed for ${pluginId}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`[StorageService] Migration error for ${pluginId}:`, error.message);
      }
    }
  }
}

export const storageService = new StorageService();
