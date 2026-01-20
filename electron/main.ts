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

  // Helper to wrap IPC handlers with logging and error handling
  const wrapIpcHandler = <T>(
    name: string,
    handler: (event: any, ...args: any[]) => Promise<T>
  ) => {
    return async (event: any, ...args: any[]) => {
      const timestamp = new Date().toISOString();
      console.log(
        `[${timestamp}] [IPC] [${name}] REQUEST:`,
        JSON.stringify(args)
      );

      try {
        const result = await handler(event, ...args);
        // Ensure result follows Result<T> structure
        const formattedResult =
          result && typeof result === 'object' && 'success' in result
            ? result
            : { success: true, data: result };

        console.log(`[${timestamp}] [IPC] [${name}] SUCCESS`);
        return formattedResult;
      } catch (error: any) {
        console.error(`[${timestamp}] [IPC] [${name}] ERROR:`, error.message);
        return { success: false, error: error.message || 'Unknown error' };
      }
    };
  };

  // IPC Handlers
  ipcMain.handle(
    'run-command',
    wrapIpcHandler('run-command', async (_event, command) => {
      const { stdout, stderr } = await execPromise(command as string);
      return { stdout, stderr };
    })
  );

  ipcMain.handle(
    'check-tool',
    wrapIpcHandler('check-tool', async (_event, tool) => {
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
    'get-pods',
    wrapIpcHandler('get-pods', async (_event, contextName) => {
      const { stdout } = await execPromise(
        `kubectl get pods --context ${contextName} -A -o json`
      );
      const data = JSON.parse(stdout);
      return data.items || [];
    })
  );

  ipcMain.handle(
    'get-namespaces',
    wrapIpcHandler('get-namespaces', async (_event, contextName) => {
      const { stdout } = await execPromise(
        `kubectl get namespaces --context ${contextName} -o name`
      );
      return stdout
        .trim()
        .split('\n')
        .map((ns) => ns.replace('namespace/', ''))
        .filter(Boolean);
    })
  );

  ipcMain.handle(
    'get-resources',
    wrapIpcHandler(
      'get-resources',
      async (_event, { contextName, resourceType, namespace }) => {
        const nsFlag = namespace === 'all' ? '-A' : `-n ${namespace}`;
        const { stdout } = await execPromise(
          `kubectl get ${resourceType} --context ${contextName} ${nsFlag} -o json`
        );
        const data = JSON.parse(stdout);
        return data.items || [];
      }
    )
  );

  ipcMain.handle(
    'get-logs',
    wrapIpcHandler(
      'get-logs',
      async (_event, { contextName, podName, namespace, tailLines }) => {
        const nsFlag =
          !namespace || namespace === 'all' ? '' : `-n ${namespace}`;
        const tail = tailLines || 200;
        const { stdout } = await execPromise(
          `kubectl logs ${podName} --context ${contextName} ${nsFlag} --tail=${tail}`
        );
        return stdout;
      }
    )
  );

  ipcMain.handle(
    'describe-resource',
    wrapIpcHandler(
      'describe-resource',
      async (
        _event,
        { contextName, resourceType, resourceName, namespace }
      ) => {
        const nsFlag =
          !namespace || namespace === 'all' ? '' : `-n ${namespace}`;
        const { stdout } = await execPromise(
          `kubectl describe ${resourceType} ${resourceName} --context ${contextName} ${nsFlag}`
        );
        return stdout;
      }
    )
  );

  ipcMain.handle(
    'get-resource-yaml',
    wrapIpcHandler(
      'get-resource-yaml',
      async (
        _event,
        { contextName, resourceType, resourceName, namespace }
      ) => {
        const nsFlag =
          !namespace || namespace === 'all' ? '' : `-n ${namespace}`;
        const { stdout } = await execPromise(
          `kubectl get ${resourceType} ${resourceName} --context ${contextName} ${nsFlag} -o yaml`
        );
        return stdout;
      }
    )
  );

  ipcMain.handle(
    'rollout-restart',
    wrapIpcHandler(
      'rollout-restart',
      async (
        _event,
        { contextName, resourceType, resourceName, namespace }
      ) => {
        const nsFlag =
          !namespace || namespace === 'all' ? '' : `-n ${namespace}`;
        await execPromise(
          `kubectl rollout restart ${resourceType}/${resourceName} --context ${contextName} ${nsFlag}`
        );
      }
    )
  );

  ipcMain.handle(
    'delete-resource',
    wrapIpcHandler(
      'delete-resource',
      async (
        _event,
        { contextName, resourceType, resourceName, namespace }
      ) => {
        const nsFlag =
          namespace === 'all' || !namespace ? '' : `-n ${namespace}`;
        await execPromise(
          `kubectl delete ${resourceType} ${resourceName} --context ${contextName} ${nsFlag}`
        );
      }
    )
  );

  ipcMain.handle(
    'delete-cluster',
    wrapIpcHandler('delete-cluster', async (_event, name) => {
      return await clusterManagementService.deleteCluster(name);
    })
  );

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
