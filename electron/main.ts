import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs/promises';
import { clusterManagementService } from './services/cluster/cluster-management-service';
import { pluginManager } from './services/plugins/plugin-manager';
import { templateService } from './services/plugins/template-service';
import { licenseManager } from './services/security/license-manager';
import { marketplaceService } from './services/marketplace/marketplace-service';
import { manifestDb } from './database';

const execPromise = util.promisify(exec);

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

export let win: BrowserWindow | null;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

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

function registerIpcHandlers() {
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
    'switch-context',
    wrapIpcHandler('switch-context', async (_event, contextName) => {
      await execPromise(`kubectl config use-context ${contextName}`);
      return true;
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

  ipcMain.handle(
    'get-app-version',
    wrapIpcHandler('get-app-version', async () => {
      try {
        const versionPath = path.join(app.getAppPath(), '.version');
        const version = await fs.readFile(versionPath, 'utf-8');
        return version.trim();
      } catch (error) {
        console.error('Error reading .version file:', error);
        return 'v0.1.0'; // Fallback
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

  // Plugin System IPC Handlers
  ipcMain.handle(
    'get-plugins',
    wrapIpcHandler('get-plugins', async () => {
      return pluginManager.getPlugins();
    })
  );

  ipcMain.handle(
    'enable-plugin',
    wrapIpcHandler('enable-plugin', async (_event, pluginId: string) => {
      await pluginManager.enablePlugin(pluginId);
      return true;
    })
  );

  ipcMain.handle(
    'disable-plugin',
    wrapIpcHandler('disable-plugin', async (_event, pluginId: string) => {
      await pluginManager.disablePlugin(pluginId);
      return true;
    })
  );

  ipcMain.handle(
    'check-for-plugin-updates',
    wrapIpcHandler('check-for-plugin-updates', async () => {
      await pluginManager.checkForUpdates();
      return true;
    })
  );

  ipcMain.handle(
    'get-plugin-extensions',
    wrapIpcHandler(
      'get-plugin-extensions',
      async (_event, extensionPoint?: string) => {
        return pluginManager.getPluginExtensions(extensionPoint);
      }
    )
  );

  ipcMain.handle(
    'generate-plugin',
    wrapIpcHandler('generate-plugin', async (_event, options: any) => {
      const pluginDir = path.join(
        app.getPath('userData'),
        'plugins',
        options.id
      );
      await templateService.scaffoldPlugin(pluginDir, options);
      return true;
    })
  );

  ipcMain.handle(
    'reload-plugin',
    wrapIpcHandler('reload-plugin', async (_event, pluginId: string) => {
      await pluginManager.reloadPlugin(pluginId);
      return true;
    })
  );

  ipcMain.handle(
    'execute-plugin-action',
    wrapIpcHandler(
      'execute-plugin-action',
      async (_event, { pluginId, actionId, args }) => {
        return await pluginManager.executePluginAction(
          pluginId,
          actionId,
          args
        );
      }
    )
  );

  ipcMain.handle(
    'get-plugin-settings',
    wrapIpcHandler('get-plugin-settings', async (_event, pluginId: string) => {
      return pluginManager.getPluginSettings(pluginId);
    })
  );

  ipcMain.handle(
    'set-plugin-settings',
    wrapIpcHandler(
      'set-plugin-settings',
      async (_event, { pluginId, settings }) => {
        await pluginManager.updatePluginSettings(pluginId, settings);
        return true;
      }
    )
  );

  ipcMain.handle(
    'uninstall-plugin',
    wrapIpcHandler('uninstall-plugin', async (_event, pluginId: string) => {
      await pluginManager.uninstallPlugin(pluginId);
      return true;
    })
  );

  ipcMain.handle(
    'activate-plugin-license',
    wrapIpcHandler(
      'activate-plugin-license',
      async (_event, { pluginId, licenseKey }) => {
        return await licenseManager.activateLicense(pluginId, licenseKey);
      }
    )
  );

  ipcMain.handle(
    'start-plugin-trial',
    wrapIpcHandler('start-plugin-trial', async (_event, pluginId: string) => {
      return await licenseManager.startTrial(pluginId);
    })
  );

  ipcMain.handle(
    'deactivate-plugin-license',
    wrapIpcHandler(
      'deactivate-plugin-license',
      async (_event, pluginId: string) => {
        return await licenseManager.deactivateLicense(pluginId);
      }
    )
  );

  // Marketplace Handlers
  ipcMain.handle(
    'get-marketplace-plugins',
    wrapIpcHandler('get-marketplace-plugins', async () => {
      return await marketplaceService.getMarketplacePlugins();
    })
  );

  ipcMain.handle(
    'install-plugin',
    wrapIpcHandler('install-plugin', async (_event, pluginId: string) => {
      return await marketplaceService.installPlugin(pluginId);
    })
  );

  // Manifest Database Handlers
  ipcMain.handle(
    'get-manifests',
    wrapIpcHandler('get-manifests', async (_event, clusterContext?: string) => {
      return manifestDb.getManifests(clusterContext);
    })
  );

  ipcMain.handle(
    'save-manifest',
    wrapIpcHandler('save-manifest', async (_event, manifest: any) => {
      return manifestDb.saveManifest(manifest);
    })
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

function createWindow() {
  const dist = process.env.DIST;
  const publicDir = process.env.VITE_PUBLIC;

  if (!dist || !publicDir) {
    throw new Error('DIST or VITE_PUBLIC is undefined');
  }

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(publicDir, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
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

app.whenReady().then(async () => {
  // 1. Initialize manifest database FIRST (it's synchronous and critical)
  try {
    console.log('[Main] Initializing manifest database...');
    manifestDb.initialize();
    console.log('[Main] Manifest database initialized');
  } catch (error: any) {
    console.error(
      '[Main] Failed to initialize manifest database:',
      error.message
    );
  }

  // 2. Register IPC handlers ONCE
  console.log('[Main] Registering IPC handlers...');
  registerIpcHandlers();

  // 3. Initialize plugin system (async)
  try {
    console.log('[Main] Initializing plugin system...');
    await pluginManager.initialize();
    console.log('[Main] Plugin system initialized');
  } catch (error: any) {
    console.error('[Main] Failed to initialize plugin system:', error.message);
  }

  // 4. Create main window
  createWindow();
});
