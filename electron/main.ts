import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { clusterManagementService } from './cluster-management-service';

const execPromise = util.promisify(exec);

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
  const dist = process.env.DIST;
  const publicDir = process.env.VITE_PUBLIC;

  if (!dist || !publicDir) {
    throw new Error('DIST or VITE_PUBLIC is undefined');
  }

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(publicDir, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // IPC Handlers
  ipcMain.handle('run-command', async (_event, command) => {
    try {
      const { stdout, stderr } = await execPromise(command as string);
      return { success: true, data: { stdout, stderr } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('check-tool', async (_event, tool) => {
    try {
      await execPromise(`${tool} --version`);
      return { success: true, data: true };
    } catch {
      return { success: false, error: `${tool} check failed` };
    }
  });

  ipcMain.handle('create-cluster', async (_event, { name, provider }) => {
    return await clusterManagementService.createCluster(name, provider);
  });

  ipcMain.handle('get-clusters', async () => {
    try {
      const { stdout } = await execPromise(
        'kubectl config get-contexts -o name'
      );
      const clusters = stdout.trim().split('\n').filter(Boolean);
      return { success: true, data: clusters };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get clusters',
      };
    }
  });

  ipcMain.handle('get-current-context', async () => {
    try {
      const { stdout } = await execPromise('kubectl config current-context');
      return { success: true, data: stdout.trim() };
    } catch (error: any) {
      return { success: false, error: error.message || 'No context found' };
    }
  });

  ipcMain.handle('get-pods', async (_event, contextName) => {
    try {
      // Use -A for all namespaces and -o json for easier parsing
      const { stdout } = await execPromise(
        `kubectl get pods --context ${contextName} -A -o json`
      );
      const data = JSON.parse(stdout);
      return { success: true, data: data.items || [] };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-namespaces', async (_event, contextName) => {
    try {
      const { stdout } = await execPromise(
        `kubectl get namespaces --context ${contextName} -o name`
      );
      const namespaces = stdout
        .trim()
        .split('\n')
        .map((ns) => ns.replace('namespace/', ''))
        .filter(Boolean);
      return { success: true, data: namespaces };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(
    'get-resources',
    async (_event, { contextName, resourceType, namespace }) => {
      try {
        const nsFlag = namespace === 'all' ? '-A' : `-n ${namespace}`;
        const { stdout } = await execPromise(
          `kubectl get ${resourceType} --context ${contextName} ${nsFlag} -o json`
        );
        const data = JSON.parse(stdout);
        return { success: true, data: data.items || [] };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle(
    'get-logs',
    async (_event, { contextName, podName, namespace, tailLines }) => {
      try {
        const nsFlag =
          !namespace || namespace === 'all' ? '' : `-n ${namespace}`;
        const tail = tailLines || 200;
        const { stdout } = await execPromise(
          `kubectl logs ${podName} --context ${contextName} ${nsFlag} --tail=${tail}`
        );
        return { success: true, data: stdout };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle(
    'describe-resource',
    async (_event, { contextName, resourceType, resourceName, namespace }) => {
      try {
        const nsFlag =
          !namespace || namespace === 'all' ? '' : `-n ${namespace}`;
        const { stdout } = await execPromise(
          `kubectl describe ${resourceType} ${resourceName} --context ${contextName} ${nsFlag}`
        );
        return { success: true, data: stdout };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle(
    'get-resource-yaml',
    async (_event, { contextName, resourceType, resourceName, namespace }) => {
      try {
        const nsFlag =
          !namespace || namespace === 'all' ? '' : `-n ${namespace}`;
        const { stdout } = await execPromise(
          `kubectl get ${resourceType} ${resourceName} --context ${contextName} ${nsFlag} -o yaml`
        );
        return { success: true, data: stdout };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle(
    'rollout-restart',
    async (_event, { contextName, resourceType, resourceName, namespace }) => {
      try {
        const nsFlag =
          !namespace || namespace === 'all' ? '' : `-n ${namespace}`;
        await execPromise(
          `kubectl rollout restart ${resourceType}/${resourceName} --context ${contextName} ${nsFlag}`
        );
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle(
    'delete-resource',
    async (_event, { contextName, resourceType, resourceName, namespace }) => {
      try {
        const nsFlag =
          namespace === 'all' || !namespace ? '' : `-n ${namespace}`;
        await execPromise(
          `kubectl delete ${resourceType} ${resourceName} --context ${contextName} ${nsFlag}`
        );
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle('delete-cluster', async (_event, name) => {
    return await clusterManagementService.deleteCluster(name);
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(dist, 'index.html'));
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);
