import { app, BrowserWindow, Menu, protocol, net } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';
import { pluginManager } from './services/plugins/plugin-manager';
import { pluginHostManager } from './services/plugins/host/plugin-host-manager';
import { pluginEventBus } from './services/plugins/plugin-events';
import { manifestDb } from './database';
import { getErrorMessage } from './utils/error-utils';
import { registerClusterIpcHandlers } from './ipc/cluster-ipc';
import { registerResourcesIpcHandlers } from './ipc/resources-ipc';
import { registerPluginsIpcHandlers } from './ipc/plugins-ipc';
import { registerMarketplaceIpcHandlers } from './ipc/marketplace-ipc';
import { registerManifestsIpcHandlers } from './ipc/manifests-ipc';
import { registerHelmIpcHandlers } from './ipc/helm-ipc';
import { registerMigrationIpcHandlers } from './ipc/migration-ipc';
import { registerTerminalIpcHandlers } from './ipc/terminal-ipc';
import { registerPortForwardIpcHandlers } from './ipc/portforward-ipc';
import { registerUpdateIpcHandlers } from './ipc/update-ipc';
import { updateService } from './services/update';
import log from './logger';

const DEFAULT_WINDOW_WIDTH = 1200;
const DEFAULT_WINDOW_HEIGHT = 800;

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

export let win: BrowserWindow | null;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

// Register custom protocol as privileged — must be called before app.whenReady()
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

function registerIpcHandlers(): void {
  registerClusterIpcHandlers();
  registerResourcesIpcHandlers();
  registerPluginsIpcHandlers();
  registerMarketplaceIpcHandlers();
  registerManifestsIpcHandlers();
  registerHelmIpcHandlers();
  registerMigrationIpcHandlers();
  registerTerminalIpcHandlers();
  registerPortForwardIpcHandlers();
  registerUpdateIpcHandlers();
}

function createWindow(): void {
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
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(dist, 'index.html'));
  }

  pluginEventBus.setMainWindow(win);

  // Push update status to the renderer, then run a startup check (packaged only).
  updateService.init((status) => {
    win?.webContents.send('update-status', status);
  });
  void updateService.checkForUpdates();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

// Tear down plugin utility processes cleanly before Electron force-kills them
app.on('before-quit', () => {
  pluginHostManager.disposeAll();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(async () => {
  // 1. Initialize manifest database FIRST (synchronous, critical)
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
      const url = new URL(request.url);

      // On Windows the pathname is /C:/Users/... — strip the leading slash
      let fullPath = decodeURIComponent(url.pathname);
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
