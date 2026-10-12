import {
  app,
  BrowserWindow,
  dialog,
  nativeTheme,
  protocol,
  screen,
  session,
} from 'electron';
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
import {
  handlePluginFileRequest,
  isPluginHostDocument,
} from './services/plugins/plugin-file-protocol';
import { openExternalSafe } from './utils/url-utils';
import { applyDesktopToolPath } from './utils/path-env';
import {
  appSettings,
  applySavedKubeconfig,
} from './services/settings/app-settings';
import log from './logger';
import { installApplicationMenu } from './menu';
import { trackWindowState, usableBounds } from './window-state';

// Desktop launchers do not read the shell profile: add the usual tool
// directories (kubectl, kind, helm...) before any child process starts.
applyDesktopToolPath();

const DEFAULT_WINDOW_WIDTH = 1200;
const DEFAULT_WINDOW_HEIGHT = 800;
const MIN_WINDOW_WIDTH = 960;
const MIN_WINDOW_HEIGHT = 600;
/** Show the window even if the renderer never reports its first paint. */
const READY_TO_SHOW_FALLBACK_MS = 10_000;
/** --bg-primary of the two themes (styles/variables.scss). */
const WINDOW_BACKGROUND = { light: '#ffffff', dark: '#0f172a' } as const;

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

export let win: BrowserWindow | null;
// Only development builds load the renderer from the Vite server: in an
// installed build the variable could point the whole preload bridge at any URL.
const VITE_DEV_SERVER_URL = app.isPackaged
  ? undefined
  : process.env['VITE_DEV_SERVER_URL'];

// One running instance per user data directory: a second launch focuses the
// existing window instead of opening a second app on the same databases.
const isPrimaryInstance = app.requestSingleInstanceLock();
if (!isPrimaryInstance) {
  log.info('[Main] Another instance is already running, quitting this one');
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
  // Plugin frames only ever show their host document: a plugin that
  // navigated its own frame elsewhere would leave the host document's CSP
  // behind (the protocol handler sends the same policy as a header too).
  contents.on('will-frame-navigate', (event) => {
    if (event.isMainFrame || isPluginHostDocument(event.url)) return;
    log.warn(`[Main] Blocked frame navigation to ${event.url}`);
    event.preventDefault();
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

  const saved = appSettings.get();
  const bounds = usableBounds(
    saved.windowBounds,
    screen.getAllDisplays().map((display) => display.workArea)
  );

  const mainWindow = new BrowserWindow({
    ...(bounds ?? {
      width: DEFAULT_WINDOW_WIDTH,
      height: DEFAULT_WINDOW_HEIGHT,
    }),
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    // Shown on the first paint (ready-to-show): no empty frame, no flash.
    show: false,
    // The frame's own colour until that paint. The renderer puts the saved
    // theme on <html> before React mounts (src/lib/theme-boot.ts).
    backgroundColor: nativeTheme.shouldUseDarkColors
      ? WINDOW_BACKGROUND.dark
      : WINDOW_BACKGROUND.light,
    // The menu bar appears with Alt; its accelerators always work.
    autoHideMenuBar: true,
    icon: path.join(publicDir, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win = mainWindow;

  const show = () => {
    if (mainWindow.isDestroyed() || mainWindow.isVisible()) return;
    if (saved.windowMaximized) mainWindow.maximize();
    mainWindow.show();
  };
  mainWindow.once('ready-to-show', show);
  // A renderer that never paints (a broken build, a page that crashed while
  // loading) must not leave an invisible process behind.
  const showFallback = setTimeout(show, READY_TO_SHOW_FALLBACK_MS);
  mainWindow.once('closed', () => clearTimeout(showFallback));

  trackWindowState(mainWindow, (state) => {
    appSettings
      .update({
        windowBounds: state.bounds,
        windowMaximized: state.maximized,
      })
      .catch((error: unknown) =>
        log.warn(
          '[Main] Could not save the window state:',
          getErrorMessage(error)
        )
      );
  });

  offerReloadWhenRendererDies(mainWindow);

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(dist, 'index.html'));
  }

  pluginEventBus.setMainWindow(mainWindow);

  // Push update status to the renderer, then run a startup check (packaged only).
  updateService.init((status) => {
    win?.webContents.send('update-status', status);
  });
  void updateService.checkForUpdates();
}

/**
 * A crashed or killed renderer used to leave a blank window with no way out;
 * offer a reload instead.
 */
function offerReloadWhenRendererDies(mainWindow: BrowserWindow): void {
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log.error(
      `[Main] The renderer process is gone: ${details.reason} (exit code ${details.exitCode})`
    );
    if (details.reason === 'clean-exit' || mainWindow.isDestroyed()) return;
    void dialog
      .showMessageBox(mainWindow, {
        type: 'error',
        title: 'Shoal',
        message: 'The Shoal window stopped working.',
        detail: `Reason: ${details.reason}. Details are in the log file (main.log).`,
        buttons: ['Reload', 'Quit'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) mainWindow.reload();
        else app.quit();
      });
  });
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
  try {
    registerIpcHandlers();
  } catch (error: unknown) {
    failToStart('Could not set up the app bridge', error);
    return;
  }

  // 4. Menu and main window. The window comes before the plugins: a plugin
  // whose activate() waits on kubectl must not delay the first paint.
  try {
    installApplicationMenu(
      process.env.VITE_PUBLIC
        ? path.join(process.env.VITE_PUBLIC, 'icon.png')
        : undefined
    );
    createWindow();
  } catch (error: unknown) {
    failToStart('Could not open the main window', error);
    return;
  }

  // 5. Initialize the plugin system in the background; the renderer follows
  // each plugin's state through plugin-state-changed events.
  log.info('[Main] Initializing plugin system...');
  pluginManager
    .initialize()
    .then(() => log.info('[Main] Plugin system initialized'))
    .catch((error: unknown) =>
      log.error(
        '[Main] Failed to initialize plugin system:',
        getErrorMessage(error)
      )
    );
});

/**
 * A startup step that throws would otherwise leave a windowless process
 * behind (electron-log catches the exception without a dialog, and the
 * single-instance lock makes a relaunch focus nothing). Tell the user and
 * quit.
 */
function failToStart(what: string, error: unknown): void {
  const message = getErrorMessage(error);
  log.error(`[Main] ${what}:`, message);
  dialog.showErrorBox(
    'Shoal could not start',
    `${what}.\n\n${message}\n\nDetails are in the log file (main.log).`
  );
  app.quit();
}

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
