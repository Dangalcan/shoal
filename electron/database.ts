import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs/promises';
import { safeExec } from './utils/safe-exec';
import { assertContext } from './utils/k8s-validate';
import { cleanupTempFile } from './utils/fs-utils';
import log from './logger';
import { privateTempPath, PRIVATE_FILE_WRITE } from './utils/temp-file';

export interface Manifest {
  id: number;
  name: string;
  cluster_context: string;
  content: string;
  folder_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ManifestFolder {
  id: number;
  name: string;
  parent_id: number | null;
  created_at: string;
  updated_at: string;
}

export type FolderDeleteMode = 'move-to-parent' | 'recursive';

class ManifestDatabase {
  private db: Database.Database | null = null;

  initialize() {
    if (this.db) return;

    const userData = app.getPath('userData');
    const dbPath = path.join(userData, 'manifests.db');

    this.db = new Database(dbPath);
    this.db.pragma('foreign_keys = ON');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS manifests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        cluster_context TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS manifest_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_id INTEGER REFERENCES manifest_folders(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.migrateManifestsFolderColumn();

    log.info('[Database] Manifest database initialized at', dbPath);
  }

  /**
   * Idempotent migration: databases created before the folders feature lack
   * the manifests.folder_id column.
   */
  private migrateManifestsFolderColumn() {
    const columns = this.db!.pragma('table_info(manifests)') as {
      name: string;
    }[];
    if (!columns.some((c) => c.name === 'folder_id')) {
      this.db!.exec(
        'ALTER TABLE manifests ADD COLUMN folder_id INTEGER REFERENCES manifest_folders(id) ON DELETE SET NULL'
      );
      log.info('[Database] Migrated manifests table: added folder_id column');
    }
  }

  private ensureInitialized() {
    if (!this.db) {
      if (app.isReady()) {
        this.initialize();
      } else {
        throw new Error('Database not initialized and app is not ready');
      }
    }
  }

  getManifests(clusterContext?: string): Manifest[] {
    this.ensureInitialized();

    if (clusterContext) {
      return this.db!.prepare(
        'SELECT * FROM manifests WHERE cluster_context = ? ORDER BY created_at DESC'
      ).all(clusterContext) as Manifest[];
    }
    return this.db!.prepare(
      'SELECT * FROM manifests ORDER BY created_at DESC'
    ).all() as Manifest[];
  }

  saveManifest(manifest: Partial<Manifest>): number {
    this.ensureInitialized();

    const { id, name, cluster_context, content, folder_id } = manifest;

    if (id) {
      // folder_id is only touched when the caller provides it, so edits from
      // the manifest form don't move the manifest back to the root.
      if (folder_id !== undefined) {
        this.db!.prepare(
          `
          UPDATE manifests
          SET name = ?, cluster_context = ?, content = ?, folder_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
        ).run(name, cluster_context, content, folder_id, id);
      } else {
        this.db!.prepare(
          `
          UPDATE manifests
          SET name = ?, cluster_context = ?, content = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
        ).run(name, cluster_context, content, id);
      }
      return id;
    } else {
      const result = this.db!.prepare(
        `
        INSERT INTO manifests (name, cluster_context, content, folder_id)
        VALUES (?, ?, ?, ?)
      `
      ).run(name, cluster_context, content, folder_id ?? null);
      return result.lastInsertRowid as number;
    }
  }

  deleteManifest(id: number): void {
    this.ensureInitialized();
    this.db!.prepare('DELETE FROM manifests WHERE id = ?').run(id);
  }

  getFolders(): ManifestFolder[] {
    this.ensureInitialized();
    return this.db!.prepare(
      'SELECT * FROM manifest_folders ORDER BY name COLLATE NOCASE ASC'
    ).all() as ManifestFolder[];
  }

  saveFolder(folder: Partial<ManifestFolder>): number {
    this.ensureInitialized();

    const { id, name, parent_id } = folder;
    if (!name || !name.trim()) {
      throw new Error('Folder name is required');
    }
    const trimmed = name.trim();

    if (id) {
      this.db!.prepare(
        `
        UPDATE manifest_folders
        SET name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      ).run(trimmed, id);
      return id;
    }

    if (parent_id != null) {
      this.assertFolderExists(parent_id);
    }
    const result = this.db!.prepare(
      `
      INSERT INTO manifest_folders (name, parent_id)
      VALUES (?, ?)
    `
    ).run(trimmed, parent_id ?? null);
    return result.lastInsertRowid as number;
  }

  deleteFolder(id: number, mode: FolderDeleteMode = 'move-to-parent'): void {
    this.ensureInitialized();

    const folder = this.db!.prepare(
      'SELECT * FROM manifest_folders WHERE id = ?'
    ).get(id) as ManifestFolder | undefined;
    if (!folder) throw new Error('Folder not found');

    const run = this.db!.transaction(() => {
      if (mode === 'recursive') {
        const ids = this.collectDescendantIds(id);
        const placeholders = ids.map(() => '?').join(', ');
        this.db!.prepare(
          `DELETE FROM manifests WHERE folder_id IN (${placeholders})`
        ).run(...ids);
        // Child folders cascade via the parent_id FK.
        this.db!.prepare('DELETE FROM manifest_folders WHERE id = ?').run(id);
      } else {
        this.db!.prepare(
          'UPDATE manifests SET folder_id = ? WHERE folder_id = ?'
        ).run(folder.parent_id, id);
        this.db!.prepare(
          'UPDATE manifest_folders SET parent_id = ? WHERE parent_id = ?'
        ).run(folder.parent_id, id);
        this.db!.prepare('DELETE FROM manifest_folders WHERE id = ?').run(id);
      }
    });
    run();
  }

  moveManifest(id: number, folderId: number | null): void {
    this.ensureInitialized();

    if (folderId != null) {
      this.assertFolderExists(folderId);
    }
    const result = this.db!.prepare(
      'UPDATE manifests SET folder_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(folderId, id);
    if (result.changes === 0) throw new Error('Manifest not found');
  }

  moveFolder(id: number, parentId: number | null): void {
    this.ensureInitialized();

    if (parentId === id) {
      throw new Error('Cannot move a folder into itself');
    }
    if (parentId != null) {
      this.assertFolderExists(parentId);
      if (this.collectDescendantIds(id).includes(parentId)) {
        throw new Error('Cannot move a folder into its own descendant');
      }
    }
    const result = this.db!.prepare(
      'UPDATE manifest_folders SET parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(parentId, id);
    if (result.changes === 0) throw new Error('Folder not found');
  }

  private assertFolderExists(id: number): void {
    const exists = this.db!.prepare(
      'SELECT 1 FROM manifest_folders WHERE id = ?'
    ).get(id);
    if (!exists) throw new Error('Folder not found');
  }

  /** Returns the folder id plus every descendant folder id. */
  private collectDescendantIds(id: number): number[] {
    const rows = this.db!.prepare(
      `
      WITH RECURSIVE subtree(id) AS (
        SELECT id FROM manifest_folders WHERE id = ?
        UNION ALL
        SELECT f.id FROM manifest_folders f
        JOIN subtree s ON f.parent_id = s.id
      )
      SELECT id FROM subtree
    `
    ).all(id) as { id: number }[];
    return rows.map((r) => r.id);
  }

  async applyManifest(id: number): Promise<{ stdout: string; stderr: string }> {
    this.ensureInitialized();

    const manifest = this.db!.prepare(
      'SELECT * FROM manifests WHERE id = ?'
    ).get(id) as Manifest;
    if (!manifest) throw new Error('Manifest not found');

    assertContext(manifest.cluster_context);

    // Write the content to a private temporary file (owner-only, random name)
    const tempFilePath = privateTempPath('shoal-manifest', '.yaml');
    await fs.writeFile(tempFilePath, manifest.content, PRIVATE_FILE_WRITE);

    try {
      const { stdout, stderr } = await safeExec('kubectl', [
        'apply',
        '-f',
        tempFilePath,
        '--context',
        manifest.cluster_context,
      ]);
      return { stdout, stderr };
    } finally {
      await cleanupTempFile(tempFilePath, '[Database] manifest apply');
    }
  }
}

export const manifestDb = new ManifestDatabase();
