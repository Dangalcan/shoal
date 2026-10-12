/**
 * Manifest Database IPC Handlers
 *
 * Covers: CRUD operations, folder organization, and applying Kubernetes
 * manifests.
 */

import { ipcMain } from 'electron';
import { manifestDb } from '../database';
import type { FolderDeleteMode, Manifest, ManifestFolder } from '../database';
import { resourceReadCache } from '../services/kubernetes/resource-read-cache';
import { wrapIpcHandler } from './ipc-utils';

const MAX_FOLDER_NAME_LENGTH = 100;

function assertId(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${label}`);
  }
}

function assertOptionalId(
  value: unknown,
  label: string
): asserts value is number | null {
  if (value !== null && value !== undefined) {
    assertId(value, label);
  }
}

const MAX_MANIFEST_NAME_LENGTH = 200;
const MAX_CONTEXT_LENGTH = 200;
/** Manifests are hand-written YAML; anything above 1 MiB is suspect. */
const MAX_MANIFEST_CONTENT_LENGTH = 1024 * 1024;

function assertManifest(
  value: unknown
): asserts value is Partial<Manifest> & { name: string; content: string } {
  const m = value as Partial<Manifest> | null | undefined;
  if (!m || typeof m !== 'object') throw new Error('Invalid manifest');
  assertOptionalId(m.id, 'manifest id');
  assertOptionalId(m.folder_id, 'folder id');
  if (typeof m.name !== 'string' || !m.name.trim()) {
    throw new Error('Manifest name is required');
  }
  if (m.name.trim().length > MAX_MANIFEST_NAME_LENGTH) {
    throw new Error(
      `Manifest name must be at most ${MAX_MANIFEST_NAME_LENGTH} characters`
    );
  }
  if (typeof m.content !== 'string' || !m.content.trim()) {
    throw new Error('Manifest content is required');
  }
  if (m.content.length > MAX_MANIFEST_CONTENT_LENGTH) {
    throw new Error('Manifest content is too large (max 1 MiB)');
  }
  if (
    m.cluster_context !== undefined &&
    (typeof m.cluster_context !== 'string' ||
      m.cluster_context.length > MAX_CONTEXT_LENGTH)
  ) {
    throw new Error('Invalid cluster context');
  }
}

function assertFolderName(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Folder name is required');
  }
  if (value.trim().length > MAX_FOLDER_NAME_LENGTH) {
    throw new Error(
      `Folder name must be at most ${MAX_FOLDER_NAME_LENGTH} characters`
    );
  }
}

export function registerManifestsIpcHandlers(): void {
  ipcMain.handle(
    'get-manifests',
    wrapIpcHandler('get-manifests', async (_event, clusterContext?: string) => {
      return manifestDb.getManifests(clusterContext);
    })
  );

  ipcMain.handle(
    'save-manifest',
    wrapIpcHandler(
      'save-manifest',
      async (_event, manifest: Partial<Manifest>) => {
        assertManifest(manifest);
        return manifestDb.saveManifest(manifest);
      }
    )
  );

  ipcMain.handle(
    'delete-manifest',
    wrapIpcHandler('delete-manifest', async (_event, id: unknown) => {
      assertId(id, 'manifest id');
      manifestDb.deleteManifest(id);
      return true;
    })
  );

  ipcMain.handle(
    'apply-manifest',
    wrapIpcHandler('apply-manifest', async (_event, id: unknown) => {
      assertId(id, 'manifest id');
      const result = await manifestDb.applyManifest(id);
      // Applying a manifest mutates the cluster — invalidate cached reads
      resourceReadCache.clear();
      return result;
    })
  );

  ipcMain.handle(
    'get-manifest-folders',
    wrapIpcHandler('get-manifest-folders', async () => {
      return manifestDb.getFolders();
    })
  );

  ipcMain.handle(
    'save-manifest-folder',
    wrapIpcHandler(
      'save-manifest-folder',
      async (_event, folder: Partial<ManifestFolder>) => {
        assertFolderName(folder?.name);
        assertOptionalId(folder?.id, 'folder id');
        assertOptionalId(folder?.parent_id, 'parent folder id');
        return manifestDb.saveFolder(folder);
      }
    )
  );

  ipcMain.handle(
    'delete-manifest-folder',
    wrapIpcHandler(
      'delete-manifest-folder',
      async (_event, id: number, mode?: FolderDeleteMode) => {
        assertId(id, 'folder id');
        if (
          mode !== undefined &&
          mode !== 'move-to-parent' &&
          mode !== 'recursive'
        ) {
          throw new Error('Invalid folder delete mode');
        }
        manifestDb.deleteFolder(id, mode);
        return true;
      }
    )
  );

  ipcMain.handle(
    'move-manifest',
    wrapIpcHandler(
      'move-manifest',
      async (_event, id: number, folderId: number | null) => {
        assertId(id, 'manifest id');
        assertOptionalId(folderId, 'folder id');
        manifestDb.moveManifest(id, folderId ?? null);
        return true;
      }
    )
  );

  ipcMain.handle(
    'move-manifest-folder',
    wrapIpcHandler(
      'move-manifest-folder',
      async (_event, id: number, parentId: number | null) => {
        assertId(id, 'folder id');
        assertOptionalId(parentId, 'parent folder id');
        manifestDb.moveFolder(id, parentId ?? null);
        return true;
      }
    )
  );
}
