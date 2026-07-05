/**
 * Cluster & Tooling IPC Handlers
 *
 * Covers: check-tool, cluster CRUD, context switching,
 * app version, and kubeconfig path management.
 *
 * The former generic `run-command` handler was removed on purpose: a
 * marketplace app must not expose arbitrary command execution to the
 * renderer. Add a dedicated, validated handler instead if a new tool
 * invocation is needed.
 */

import { ipcMain, app, shell } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { safeExec, ALLOWED_TOOLS } from '../utils/safe-exec';
import { clusterManagementService } from '../services/cluster/cluster-management-service';
import { wrapIpcHandler, assertContext } from './ipc-utils';

export function registerClusterIpcHandlers(): void {
  ipcMain.handle(
    'open-external',
    wrapIpcHandler('open-external', async (_event, url: string) => {
      // Only http(s) — never file:, javascript:, or arbitrary schemes.
      let parsed: URL;
      try {
        parsed = new URL(String(url));
      } catch {
        throw new Error(`Invalid URL: "${url}"`);
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`Refusing to open non-http(s) URL: "${url}"`);
      }
      await shell.openExternal(parsed.toString());
      return true;
    })
  );

  ipcMain.handle(
    'check-tool',
    wrapIpcHandler('check-tool', async (_event, tool) => {
      if (!ALLOWED_TOOLS.has(String(tool))) {
        throw new Error(`Tool not allowed: "${tool}"`);
      }
      await safeExec(String(tool), ['--version']);
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
    'get-app-version',
    wrapIpcHandler('get-app-version', async () => {
      try {
        const versionPath = path.join(app.getAppPath(), '.version');
        const version = await fs.readFile(versionPath, 'utf-8');
        return version.trim();
      } catch {
        return app.getVersion() || 'unknown';
      }
    })
  );

  ipcMain.handle(
    'get-kubeconfig-path',
    wrapIpcHandler('get-kubeconfig-path', async () => {
      return process.env.KUBECONFIG || '';
    })
  );

  ipcMain.handle(
    'set-kubeconfig-path',
    wrapIpcHandler('set-kubeconfig-path', async (_event, pathStr: string) => {
      if (pathStr) {
        process.env.KUBECONFIG = pathStr;
      } else {
        delete process.env.KUBECONFIG;
      }
      return true;
    })
  );
}
