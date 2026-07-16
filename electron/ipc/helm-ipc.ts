/**
 * Helm IPC Handlers
 *
 * Thin wrappers over HelmService; all argument validation lives in the
 * service layer so plugin-reachable paths cannot bypass it.
 */

import { ipcMain } from 'electron';
import { helmService } from '../services/helm/helm-service';
import { wrapIpcHandler } from './ipc-utils';

export function registerHelmIpcHandlers(): void {
  ipcMain.handle(
    'helm:install',
    wrapIpcHandler('helm:install', async (_event, args) => {
      return await helmService.install(args);
    })
  );

  ipcMain.handle(
    'helm:upgrade',
    wrapIpcHandler('helm:upgrade', async (_event, args) => {
      return await helmService.upgrade(args);
    })
  );

  ipcMain.handle(
    'helm:rollback',
    wrapIpcHandler('helm:rollback', async (_event, args) => {
      return await helmService.rollback(args);
    })
  );

  ipcMain.handle(
    'helm:uninstall',
    wrapIpcHandler('helm:uninstall', async (_event, args) => {
      return await helmService.uninstall(args);
    })
  );

  ipcMain.handle(
    'helm:repo-add',
    wrapIpcHandler('helm:repo-add', async (_event, args) => {
      return await helmService.repoAdd(args);
    })
  );

  ipcMain.handle(
    'helm:repo-list',
    wrapIpcHandler('helm:repo-list', async () => {
      return await helmService.repoList();
    })
  );
}
