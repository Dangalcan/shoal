import { app, BrowserWindow, Menu, protocol, session } from 'electron';
import path from 'path';
import { pluginManager } from './services/plugins/plugin-manager';
import { pluginHostManager } from './services/plugins/host/plugin-host-manager';
import { pluginEventBus } from './services/plugins/plugin-events';
import { manifestDb } from './database';
import { getErrorMessage } from './utils/error-utils';
import { registerClusterIpcHandlers } from './ipc/cluster-ipc';
import { registerToolIpcHandlers } from './ipc/tool-ipc';
import { registerAppIpcHandlers } from './ipc/app-ipc';
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
import { handlePluginFileRequest } from './services/plugins/plugin-file-protocol';
import { openExternalSafe } from './utils/url-utils';
import { applyDesktopToolPath } from './utils/path-env';
import {
  appSettings,
  applySavedKubeconfig,
} from './services/settings/app-settings';
import log from './logger';

// Desktop launchers do not read the shell profile: add the usual tool
// directories (kubectl, kind, helm...) before any child process starts.
applyDesktopToolPath();

const DEFAULT_WINDOW_WIDTH = 1200;
const DEFAULT_WINDOW_HEIGHT = 800;

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

export let win: BrowserWindow | null;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

// One running instance per user data directory: a second launch focuses the
// existing window instead of opening a second app on the same databases.
const isPrimaryInstance = app.requestSingleInstanceLock();
if (!isPrimaryInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
}

// No window may open inside the app and the main document may not navigate
// away from itself (reloads and hash routes are fine). http(s) links go to the
// system browser.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url).catch((error: unknown) =>
      log.warn('[Main] Blocked window.open:', getErrorMessage(error))
    );
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (url !== contents.getURL()) {
      log.warn(`[Main] Blocked navigation to ${url}`);
      event.preventDefault();
    }
  });
});

// Electron grants every web permission request by default. Deny them all
// (camera, microphone, geolocation, notifications, ...) except clipboard
// writes, which the UI uses to copy YAML.
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write']);

function restrictPermissions(): void {
  session.defaultSession.setPermissionRequestHandler(
    (_contents, permission, callback) => {
      const allowed = ALLOWED_PERMISSIONS.has(permission);
      if (!allowed) log.warn(`[Main] Denied permission request: ${permission}`);
      callback(allowed);
    }
  );
  session.defaultSession.setPermissionCheckHandler((_contents, permission) =>
    ALLOWED_PERMISSIONS.has(permission)
  );
}

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
  registerToolIpcHandlers();
  registerAppIpcHandlers();
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
  if (!isPrimaryInstance) return;

  restrictPermissions();

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

  // 2. Apply saved settings (kubeconfig path) before any kubectl call
  try {
    applySavedKubeconfig(await appSettings.load());
  } catch (error: unknown) {
    log.error('[Main] Failed to load app settings:', getErrorMessage(error));
  }

  // 3. Register IPC handlers ONCE
  log.info('[Main] Registering IPC handlers...');
  registerIpcHandlers();

  // 4. Initialize plugin system (async)
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

  // 5. Hide menu in production
  if (app.isPackaged) {
    Menu.setApplicationMenu(null);
  }

  // 6. Create main window
  createWindow();
});

// Register custom protocol for local plugin assets
app.whenReady().then(() => {
  // Only files inside the plugin directories are served (403 otherwise).
  protocol.handle('plugin-file', async (request) => {
    try {
      return await handlePluginFileRequest(request);
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      log.error('[Protocol] Failed to handle plugin-file request:', msg);
      return new Response('File not found: ' + msg, { status: 404 });
    }
  });
});
