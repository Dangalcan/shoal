import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs/promises';
import log from './logger';

const execPromise = util.promisify(exec);

export interface Manifest {
  id: number;
  name: string;
  cluster_context: string;
  content: string;
  created_at: string;
  updated_at: string;
}

class ManifestDatabase {
  private db: Database.Database | null = null;

  initialize() {
    if (this.db) return;

    const userData = app.getPath('userData');
    const dbPath = path.join(userData, 'manifests.db');

    this.db = new Database(dbPath);

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

    log.info('[Database] Manifest database initialized at', dbPath);
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

    const { id, name, cluster_context, content } = manifest;

    if (id) {
      this.db!.prepare(
        `
        UPDATE manifests 
        SET name = ?, cluster_context = ?, content = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      ).run(name, cluster_context, content, id);
      return id;
    } else {
      const result = this.db!.prepare(
        `
        INSERT INTO manifests (name, cluster_context, content)
        VALUES (?, ?, ?)
      `
      ).run(name, cluster_context, content);
      return result.lastInsertRowid as number;
    }
  }

  deleteManifest(id: number): void {
    this.ensureInitialized();
    this.db!.prepare('DELETE FROM manifests WHERE id = ?').run(id);
  }

  async applyManifest(id: number): Promise<{ stdout: string; stderr: string }> {
    this.ensureInitialized();

    const manifest = this.db!.prepare(
      'SELECT * FROM manifests WHERE id = ?'
    ).get(id) as Manifest;
    if (!manifest) throw new Error('Manifest not found');

    // Validate context name to prevent shell injection — only allow safe k8s context characters
    if (!/^[a-zA-Z0-9._\-:@/]+$/.test(manifest.cluster_context)) {
      throw new Error(
        `Invalid cluster context name: "${manifest.cluster_context}"`
      );
    }

    // Write content to a temporary file
    const tempFilePath = path.join(app.getPath('temp'), `manifest-${id}.yaml`);
    await fs.writeFile(tempFilePath, manifest.content);

    try {
      const { stdout, stderr } = await execPromise(
        `kubectl apply -f "${tempFilePath}" --context "${manifest.cluster_context}"`
      );
      return { stdout, stderr };
    } finally {
      await fs
        .unlink(tempFilePath)
        .catch((e) =>
          log.warn(
            `[Database] Failed to clean up temp file ${tempFilePath}:`,
            e
          )
        );
    }
  }
}

export const manifestDb = new ManifestDatabase();
