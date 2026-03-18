import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  dialog,
  protocol,
  net,
} from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { pathToFileURL } from 'url';
import { clusterManagementService } from './services/cluster/cluster-management-service';
import { kubernetesService } from './services/kubernetes/kubernetes-service';
import { pluginManager } from './services/plugins/plugin-manager';
import { pluginEventBus } from './services/plugins/plugin-events';
import { templateService } from './services/plugins/template-service';
import { licenseManager } from './services/security/license-manager';
import { marketplaceService } from './services/marketplace/marketplace-service';
import { manifestDb } from './database';
import type { Manifest } from './database';
import type { PluginScaffoldOptions } from './types/plugin-types';
import { execPromise } from './utils/exec-utils';
import { getErrorMessage } from './utils/error-utils';
import log from './logger';

const DEFAULT_LOG_TAIL_LINES = 200;
const DEFAULT_WINDOW_WIDTH = 1200;
const DEFAULT_WINDOW_HEIGHT = 800;

// ---------------------------------------------------------------------------
// Input validation helpers — all kubectl arguments must pass before use in
// shell commands to prevent command injection from a compromised renderer.
// ---------------------------------------------------------------------------

const ALLOWED_TOOLS = new Set([
  'kubectl',
  'helm',
  'kind',
  'minikube',
  'k3d',
  'k9s',
  'kubectx',
  'kubens',
  'docker',
  'podman',
]);

/** Kubernetes context names: alphanumeric + .-_@/:  */
const CONTEXT_NAME_RE = /^[a-zA-Z0-9._\-@/:]+$/;
/** Kubernetes resource types: alphanumeric + ./  */
const RESOURCE_TYPE_RE = /^[a-zA-Z0-9./]+$/;
/** Kubernetes namespaces: RFC 1123 DNS label, or the literal "all" */
const NAMESPACE_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$|^all$/;
/** Kubernetes resource/pod names: alphanumeric + .-_ */
const RESOURCE_NAME_RE = /^[a-zA-Z0-9._\-]+$/;

function assertContext(v: string) {
  if (!v || !CONTEXT_NAME_RE.test(v))
    throw new Error(`Invalid context name: "${v}"`);
}
function assertResourceType(v: string) {
  if (!v || !RESOURCE_TYPE_RE.test(v))
    throw new Error(`Invalid resource type: "${v}"`);
}
function assertNamespace(v: string) {
  if (!v || !NAMESPACE_RE.test(v)) throw new Error(`Invalid namespace: "${v}"`);
}
function assertResourceName(v: string) {
  if (!v || !RESOURCE_NAME_RE.test(v))
    throw new Error(`Invalid resource name: "${v}"`);
}

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

export let win: BrowserWindow | null;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

// Register custom protocol as privileged
// This must be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'plugin-file',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

// Helper to wrap IPC handlers with logging and error handling
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wrapIpcHandler = <T>(
  name: string,
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T>
) => {
  return async (event: IpcMainInvokeEvent, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    log.debug(`[${timestamp}] [IPC] [${name}] REQUEST:`, JSON.stringify(args));

    try {
      const result = await handler(event, ...args);
      // Ensure result follows Result<T> structure
      const formattedResult =
        result && typeof result === 'object' && 'success' in result
          ? result
          : { success: true, data: result };

      log.debug(`[${timestamp}] [IPC] [${name}] SUCCESS`);
      return formattedResult;
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      log.error(`[${timestamp}] [IPC] [${name}] ERROR:`, msg);
      return { success: false, error: msg };
    }
  };
};

function registerIpcHandlers() {
  ipcMain.handle(
    'run-command',
    wrapIpcHandler('run-command', async (_event, command) => {
      // Only allow commands that start with a known safe tool name.
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
    'get-pods',
    wrapIpcHandler('get-pods', async (_event, contextName) => {
      assertContext(contextName);
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
      assertContext(contextName);
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
        assertContext(contextName);
        assertResourceType(resourceType);
        if (namespace !== 'all') assertNamespace(namespace);
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
        assertContext(contextName);
        assertResourceName(podName);
        if (namespace && namespace !== 'all') assertNamespace(namespace);
        const nsFlag =
          !namespace || namespace === 'all' ? '' : `-n ${namespace}`;
        const tail =
          Number.isInteger(tailLines) && tailLines > 0
            ? tailLines
            : DEFAULT_LOG_TAIL_LINES;
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
        assertContext(contextName);
        assertResourceType(resourceType);
        assertResourceName(resourceName);
        if (namespace && namespace !== 'all') assertNamespace(namespace);
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
        assertContext(contextName);
        assertResourceType(resourceType);
        assertResourceName(resourceName);
        if (namespace && namespace !== 'all') assertNamespace(namespace);
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
        assertContext(contextName);
        assertResourceType(resourceType);
        assertResourceName(resourceName);
        if (namespace && namespace !== 'all') assertNamespace(namespace);
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
        return await kubernetesService.deleteResource(
          resourceType,
          resourceName,
          namespace,
          contextName
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
      const autoDeps = await pluginManager.enablePlugin(pluginId);
      return autoDeps;
    })
  );

  ipcMain.handle(
    'disable-plugin',
    wrapIpcHandler('disable-plugin', async (_event, pluginId: string) => {
      return await pluginManager.disablePlugin(pluginId);
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
    wrapIpcHandler(
      'generate-plugin',
      async (_event, options: PluginScaffoldOptions) => {
        const pluginDir = path.join(
          app.getPath('userData'),
          'plugins',
          options.id
        );
        await templateService.scaffoldPlugin(pluginDir, options);
        return true;
      }
    )
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

  ipcMain.handle(
    'import-local-plugin',
    wrapIpcHandler('import-local-plugin', async () => {
      if (!win) {
        throw new Error('No window available');
      }

      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: 'Select Plugin Directory',
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: 'Import Plugin',
      });

      if (canceled || filePaths.length === 0) {
        return null; // Cancelled
      }

      const sourcePath = filePaths[0];
      return await pluginManager.importPlugin(sourcePath);
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

function createWindow() {
  const dist = process.env.DIST;
  const publicDir = process.env.VITE_PUBLIC;

  if (!dist || !publicDir) {
    throw new Error('DIST or VITE_PUBLIC is undefined');
  }

  win = new BrowserWindow({
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
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

  // Make the window available to plugin context without circular imports.
  pluginEventBus.setMainWindow(win);
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
    log.info('[Main] Initializing manifest database...');
    manifestDb.initialize();
    log.info('[Main] Manifest database initialized');
  } catch (error: unknown) {
    log.error(
      '[Main] Failed to initialize manifest database:',
      getErrorMessage(error)
    );
  }

  // 2. Register IPC handlers ONCE
  log.info('[Main] Registering IPC handlers...');
  registerIpcHandlers();

  // 3. Initialize plugin system (async)
  try {
    log.info('[Main] Initializing plugin system...');
    await pluginManager.initialize();
    log.info('[Main] Plugin system initialized');
  } catch (error: unknown) {
    log.error(
      '[Main] Failed to initialize plugin system:',
      getErrorMessage(error)
    );
  }

  // 4. Hide menu in production
  if (app.isPackaged) {
    Menu.setApplicationMenu(null);
  }

  // 5. Create main window
  createWindow();
});

// Register custom protocol for local plugin assets
app.whenReady().then(() => {
  protocol.handle('plugin-file', async (request) => {
    try {
      // Use URL to parse correctly
      const url = new URL(request.url);

      // On Windows, with triple slash, pathname will be like /C:/Users/...
      let fullPath = decodeURIComponent(url.pathname);

      // If starts with /C:/, remove leading slash for Node path compatibility
      if (fullPath.startsWith('/') && /^\/[a-zA-Z]:/.test(fullPath)) {
        fullPath = fullPath.slice(1);
      }

      const normalizedPath = path.normalize(fullPath);
      const fileUrl = pathToFileURL(normalizedPath).toString();

      return await net.fetch(fileUrl);
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      log.error('[Protocol] Failed to handle plugin-file request:', msg);
      return new Response('File not found: ' + msg, { status: 404 });
    }
  });
});
