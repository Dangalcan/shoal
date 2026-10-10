/**
 * Cluster & Tooling IPC Handlers
 *
 * Covers: cluster CRUD, context switching, feature flags, app version, and
 * kubeconfig path management. Tool detection lives in tool-ipc.ts.
 *
 * The former generic `run-command` handler was removed on purpose: a
 * marketplace app must not expose arbitrary command execution to the
 * renderer. Add a dedicated, validated handler instead if a new tool
 * invocation is needed.
 */

import { ipcMain, app } from 'electron';
import { safeExec } from '../utils/safe-exec';
import {
  appSettings,
  assertKubeconfigPath,
} from '../services/settings/app-settings';
import { clusterManagementService } from '../services/cluster/cluster-management-service';
import { wrapIpcHandler, assertContext } from './ipc-utils';
import { isMarketplaceEnabled } from '../utils/env-utils';
import { openExternalSafe } from '../utils/url-utils';

export function registerClusterIpcHandlers(): void {
  ipcMain.handle(
    'open-external',
    wrapIpcHandler('open-external', async (_event, url: string) => {
      await openExternalSafe(url);
      return true;
    })
  );

  ipcMain.handle(
    'create-cluster',
    wrapIpcHandler('create-cluster', async (_event, { name, provider }) => {
      return await clusterManagementService.createCluster(name, provider);
    })
  );

  ipcMain.handle(
    'delete-cluster',
    wrapIpcHandler('delete-cluster', async (_event, name) => {
      return await clusterManagementService.deleteCluster(name);
    })
  );

  ipcMain.handle(
    'get-clusters',
    wrapIpcHandler('get-clusters', async () => {
      const { stdout } = await safeExec('kubectl', [
        'config',
        'get-contexts',
        '-o',
        'name',
      ]);
      return stdout.trim().split('\n').filter(Boolean);
    })
  );

  ipcMain.handle(
    'get-current-context',
    wrapIpcHandler('get-current-context', async () => {
      const { stdout } = await safeExec('kubectl', [
        'config',
        'current-context',
      ]);
      return stdout.trim();
    })
  );

  ipcMain.handle(
    'switch-context',
    wrapIpcHandler('switch-context', async (_event, contextName) => {
      assertContext(contextName);
      await safeExec('kubectl', ['config', 'use-context', contextName]);
      return true;
    })
  );

  ipcMain.handle(
    'get-feature-flags',
    wrapIpcHandler('get-feature-flags', async () => ({
      marketplace: isMarketplaceEnabled(),
    }))
  );

  ipcMain.handle(
    'get-app-version',
    // package.json is the single source of truth (electron-updater compares
    // against it too); dev and packaged builds report the same value.
    wrapIpcHandler('get-app-version', async () => `v${app.getVersion()}`)
  );

  ipcMain.handle(
    'get-kubeconfig-path',
    wrapIpcHandler('get-kubeconfig-path', async () => {
      return process.env.KUBECONFIG || '';
    })
  );

  ipcMain.handle(
    'set-kubeconfig-path',
    // Validated and saved to app-settings.json, so it survives restarts.
    wrapIpcHandler('set-kubeconfig-path', async (_event, pathStr: unknown) => {
      const value = typeof pathStr === 'string' ? pathStr.trim() : '';
      if (value) {
        await assertKubeconfigPath(value);
        process.env.KUBECONFIG = value;
        await appSettings.update({ kubeconfigPath: value });
      } else {
        delete process.env.KUBECONFIG;
        await appSettings.update({ kubeconfigPath: undefined });
      }
      return true;
    })
  );
}
