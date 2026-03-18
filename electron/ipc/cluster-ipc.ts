/**
 * Cluster & Tooling IPC Handlers
 *
 * Covers: run-command, check-tool, cluster CRUD, context switching,
 * app version, and kubeconfig path management.
 */

import { ipcMain, app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { execPromise } from '../utils/exec-utils';
import { clusterManagementService } from '../services/cluster/cluster-management-service';
import { wrapIpcHandler, ALLOWED_TOOLS, assertContext } from './ipc-utils';

export function registerClusterIpcHandlers(): void {
  ipcMain.handle(
    'run-command',
    wrapIpcHandler('run-command', async (_event, command) => {
      const firstWord = String(command).trimStart().split(/\s+/)[0];
      if (!ALLOWED_TOOLS.has(firstWord)) {
        throw new Error(
          `Command not allowed: "${firstWord}". Only Kubernetes tooling is permitted.`
        );
      }
      const { stdout, stderr } = await execPromise(command as string);
      return { stdout, stderr };
    })
  );

  ipcMain.handle(
    'check-tool',
    wrapIpcHandler('check-tool', async (_event, tool) => {
      if (!ALLOWED_TOOLS.has(String(tool))) {
        throw new Error(`Tool not allowed: "${tool}"`);
      }
      await execPromise(`${tool} --version`);
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
      const { stdout } = await execPromise(
        'kubectl config get-contexts -o name'
      );
      return stdout.trim().split('\n').filter(Boolean);
    })
  );

  ipcMain.handle(
    'get-current-context',
    wrapIpcHandler('get-current-context', async () => {
      const { stdout } = await execPromise('kubectl config current-context');
      return stdout.trim();
    })
  );

  ipcMain.handle(
    'switch-context',
    wrapIpcHandler('switch-context', async (_event, contextName) => {
      assertContext(contextName);
      await execPromise(`kubectl config use-context ${contextName}`);
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
