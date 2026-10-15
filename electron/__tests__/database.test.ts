import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';

/**
 * The manifest database against a real SQLite file in a temporary user data
 * directory: schema, the folder_id migration, manifests, folders and
 * `applyManifest`, which hands kubectl a private temporary file.
 */

let userData = '';
let appReady = true;

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => userData),
    isReady: vi.fn(() => appReady),
  },
}));
vi.mock('../logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../utils/safe-exec', () => ({ safeExec: vi.fn() }));

import { manifestDb } from '../database';
import { safeExec } from '../utils/safe-exec';
import log from '../logger';

/** The singleton keeps its connection; close it so each test starts clean. */
function closeDb(): void {
  const inner = manifestDb as unknown as { db: Database.Database | null };
  inner.db?.close();
  inner.db = null;
}

function dbFile(): string {
  return path.join(userData, 'manifests.db');
}

function saveManifest(
  name: string,
  folderId: number | null = null,
  context = 'kind-test'
): number {
  return manifestDb.saveManifest({
    name,
    cluster_context: context,
    content: `kind: ConfigMap\nmetadata:\n  name: ${name}\n`,
    folder_id: folderId,
  });
}

function manifestById(id: number) {
  return manifestDb.getManifests().find((m) => m.id === id);
}

describe('ManifestDatabase', () => {
  beforeEach(() => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-manifest-db-'));
    appReady = true;
    vi.mocked(safeExec).mockReset();
    vi.mocked(log.info).mockClear();
  });

  afterEach(() => {
    closeDb();
    fs.rmSync(userData, { recursive: true, force: true });
  });

  it('creates the schema on first use, once', () => {
    manifestDb.initialize();
    manifestDb.initialize();

    expect(fs.existsSync(dbFile())).toBe(true);
    // A second, read-only connection; closed before the directory is removed.
    const probe = new Database(dbFile(), { readonly: true });
    const tables = probe
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);
    probe.close();
    expect(tables).toEqual(
      expect.arrayContaining(['manifests', 'manifest_folders'])
    );
    const initLogs = vi
      .mocked(log.info)
      .mock.calls.filter(([msg]) => String(msg).includes('initialized'));
    expect(initLogs).toHaveLength(1);
  });

  it('adds folder_id to a database created before folders existed', () => {
    const old = new Database(dbFile());
    old.exec(`
      CREATE TABLE manifests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        cluster_context TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    old
      .prepare(
        'INSERT INTO manifests (name, cluster_context, content) VALUES (?, ?, ?)'
      )
      .run('legacy', 'kind-old', 'kind: Pod');
    old.close();

    manifestDb.initialize();

    const [legacy] = manifestDb.getManifests();
    expect(legacy).toMatchObject({ name: 'legacy', folder_id: null });
    expect(
      vi
        .mocked(log.info)
        .mock.calls.some(([msg]) => String(msg).includes('Migrated'))
    ).toBe(true);

    // Reopening the same file must not try to add the column again.
    closeDb();
    vi.mocked(log.info).mockClear();
    manifestDb.initialize();
    expect(
      vi
        .mocked(log.info)
        .mock.calls.some(([msg]) => String(msg).includes('Migrated'))
    ).toBe(false);
  });

  it('refuses to work before the app is ready, then initializes lazily', () => {
    appReady = false;
    expect(() => manifestDb.getManifests()).toThrow(
      'Database not initialized and app is not ready'
    );

    appReady = true;
    expect(manifestDb.getManifests()).toEqual([]);
  });

  it('saves, lists, updates and deletes manifests', () => {
    const folder = manifestDb.saveFolder({ name: 'apps' });
    const a = saveManifest('a', folder, 'kind-a');
    const b = saveManifest('b', null, 'kind-b');

    expect(manifestDb.getManifests()).toHaveLength(2);
    expect(manifestDb.getManifests('kind-a').map((m) => m.id)).toEqual([a]);
    expect(manifestById(a)).toMatchObject({ folder_id: folder });

    // An edit from the form carries no folder_id and must not move it.
    manifestDb.saveManifest({
      id: a,
      name: 'a2',
      cluster_context: 'kind-a',
      content: 'kind: Secret',
    });
    expect(manifestById(a)).toMatchObject({
      name: 'a2',
      content: 'kind: Secret',
      folder_id: folder,
    });

    // An explicit folder_id (null here) does move it.
    manifestDb.saveManifest({
      id: a,
      name: 'a2',
      cluster_context: 'kind-a',
      content: 'kind: Secret',
      folder_id: null,
    });
    expect(manifestById(a)).toMatchObject({ folder_id: null });

    manifestDb.deleteManifest(b);
    expect(manifestDb.getManifests().map((m) => m.id)).toEqual([a]);
  });

  it('validates folders and lists them case-insensitively', () => {
    expect(() => manifestDb.saveFolder({ name: '   ' })).toThrow(
      'Folder name is required'
    );
    expect(() => manifestDb.saveFolder({ name: 'x', parent_id: 99 })).toThrow(
      'Folder not found'
    );

    const beta = manifestDb.saveFolder({ name: '  beta ' });
    const alpha = manifestDb.saveFolder({ name: 'Alpha', parent_id: beta });
    expect(manifestDb.getFolders().map((f) => f.name)).toEqual([
      'Alpha',
      'beta',
    ]);
    expect(manifestDb.getFolders().find((f) => f.id === alpha)).toMatchObject({
      parent_id: beta,
    });

    manifestDb.saveFolder({ id: beta, name: 'Gamma' });
    expect(manifestDb.getFolders().map((f) => f.name)).toEqual([
      'Alpha',
      'Gamma',
    ]);
  });

  it('deleting a folder lifts its children and manifests to the parent', () => {
    const root = manifestDb.saveFolder({ name: 'root' });
    const child = manifestDb.saveFolder({ name: 'child', parent_id: root });
    const grandchild = manifestDb.saveFolder({
      name: 'grandchild',
      parent_id: child,
    });
    const inChild = saveManifest('in-child', child);

    manifestDb.deleteFolder(child);

    expect(manifestById(inChild)).toMatchObject({ folder_id: root });
    expect(
      manifestDb.getFolders().find((f) => f.id === grandchild)
    ).toMatchObject({ parent_id: root });
    expect(manifestDb.getFolders().some((f) => f.id === child)).toBe(false);
    expect(() => manifestDb.deleteFolder(child)).toThrow('Folder not found');
  });

  it('deleting a folder recursively removes the subtree and its manifests', () => {
    const root = manifestDb.saveFolder({ name: 'root' });
    const child = manifestDb.saveFolder({ name: 'child', parent_id: root });
    const grandchild = manifestDb.saveFolder({
      name: 'grandchild',
      parent_id: child,
    });
    const inRoot = saveManifest('in-root', root);
    saveManifest('in-child', child);
    saveManifest('in-grandchild', grandchild);

    manifestDb.deleteFolder(child, 'recursive');

    expect(manifestDb.getManifests().map((m) => m.id)).toEqual([inRoot]);
    expect(manifestDb.getFolders().map((f) => f.id)).toEqual([root]);
  });

  it('moves manifests and folders only to targets that exist', () => {
    const root = manifestDb.saveFolder({ name: 'root' });
    const child = manifestDb.saveFolder({ name: 'child', parent_id: root });
    const other = manifestDb.saveFolder({ name: 'other' });
    const id = saveManifest('m');

    expect(() => manifestDb.moveManifest(id, 99)).toThrow('Folder not found');
    expect(() => manifestDb.moveManifest(99, null)).toThrow(
      'Manifest not found'
    );
    manifestDb.moveManifest(id, child);
    expect(manifestById(id)).toMatchObject({ folder_id: child });
    manifestDb.moveManifest(id, null);
    expect(manifestById(id)).toMatchObject({ folder_id: null });

    expect(() => manifestDb.moveFolder(root, root)).toThrow(
      'Cannot move a folder into itself'
    );
    expect(() => manifestDb.moveFolder(root, child)).toThrow(
      'Cannot move a folder into its own descendant'
    );
    expect(() => manifestDb.moveFolder(root, 99)).toThrow('Folder not found');
    expect(() => manifestDb.moveFolder(99, null)).toThrow('Folder not found');

    manifestDb.moveFolder(child, other);
    expect(manifestDb.getFolders().find((f) => f.id === child)).toMatchObject({
      parent_id: other,
    });
    manifestDb.moveFolder(child, null);
    expect(manifestDb.getFolders().find((f) => f.id === child)).toMatchObject({
      parent_id: null,
    });
  });

  describe('applyManifest', () => {
    /** The temp file kubectl was given, read while the command "runs". */
    function captureKubectlInput() {
      const seen = { path: '', content: '', existed: false };
      vi.mocked(safeExec).mockImplementation(async (_cmd, args) => {
        const file = (args as string[])[2];
        seen.path = file;
        seen.existed = fs.existsSync(file);
        seen.content = fs.readFileSync(file, 'utf8');
        return { stdout: 'configmap/m created', stderr: '' };
      });
      return seen;
    }

    it('runs kubectl apply on a private temporary file and removes it', async () => {
      const id = saveManifest('m', null, 'kind-test');
      const seen = captureKubectlInput();

      await expect(manifestDb.applyManifest(id)).resolves.toEqual({
        stdout: 'configmap/m created',
        stderr: '',
      });

      expect(safeExec).toHaveBeenCalledWith('kubectl', [
        'apply',
        '-f',
        seen.path,
        '--context',
        'kind-test',
      ]);
      expect(seen.existed).toBe(true);
      expect(seen.content).toContain('name: m');
      expect(path.basename(seen.path)).toMatch(/^shoal-manifest.*\.yaml$/);
      expect(fs.existsSync(seen.path)).toBe(false);
    });

    it('removes the temporary file when kubectl fails', async () => {
      const id = saveManifest('m');
      let file = '';
      vi.mocked(safeExec).mockImplementation(async (_cmd, args) => {
        file = (args as string[])[2];
        throw new Error('kubectl: connection refused');
      });

      await expect(manifestDb.applyManifest(id)).rejects.toThrow(
        'connection refused'
      );
      expect(file).not.toBe('');
      expect(fs.existsSync(file)).toBe(false);
    });

    it('refuses unknown manifests and invalid contexts before running anything', async () => {
      await expect(manifestDb.applyManifest(999)).rejects.toThrow(
        'Manifest not found'
      );

      const id = saveManifest('m', null, '--context-as-flag');
      await expect(manifestDb.applyManifest(id)).rejects.toThrow(
        'Invalid context name'
      );
      expect(safeExec).not.toHaveBeenCalled();
    });
  });
});
