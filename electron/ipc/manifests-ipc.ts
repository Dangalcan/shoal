/**
 * Manifest Database IPC Handlers
 *
 * Covers: CRUD operations and applying Kubernetes manifests.
 */

import { ipcMain } from 'electron';
import { manifestDb } from '../database';
import type { Manifest } from '../database';
import { wrapIpcHandler } from './ipc-utils';

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
        return manifestDb.saveManifest(manifest);
      }
    )
  );

  ipcMain.handle(
    'delete-manifest',
    wrapIpcHandler('delete-manifest', async (_event, id: number) => {
      manifestDb.deleteManifest(id);
      return true;
    })
  );

  ipcMain.handle(
    'apply-manifest',
    wrapIpcHandler('apply-manifest', async (_event, id: number) => {
      return await manifestDb.applyManifest(id);
    })
  );
}
