import { _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../..');

export interface LaunchOptions {
  /** User data directory; a fresh temporary one is created when omitted. */
  userDataDir?: string;
  /** Extra environment for the app (for example KUBECONFIG). */
  env?: NodeJS.ProcessEnv;
}

/**
 * Launches Shoal for an E2E test.
 *
 * - Default: the dev build in this repo (`dist-electron/main.js`, run
 *   `npm run build:react && npm run build:electron` first), with unsigned
 *   plugins allowed.
 * - With SHOAL_E2E_EXECUTABLE set: that packaged executable (installed
 *   Shoal.exe, AppImage, ...). Packaged builds ignore ALLOW_UNSIGNED_PLUGINS,
 *   so only the signed example plugins load, exactly as for users.
 *
 * Every launch gets its own user data directory so tests start from a clean
 * first run (bundled example plugins enabled, empty databases).
 */
export async function launchApp(
  options: LaunchOptions = {}
): Promise<ElectronApplication> {
  const userDataDir =
    options.userDataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-e2e-'));
  const executablePath = process.env.SHOAL_E2E_EXECUTABLE;
  const env = {
    ...process.env,
    ALLOW_UNSIGNED_PLUGINS: 'true',
    NODE_ENV: 'test',
    ...options.env,
  };

  if (executablePath) {
    // Ubuntu 24.04 restricts the unprivileged user namespaces Chromium's
    // sandbox needs; CI runners cannot lift that restriction.
    const sandboxArgs = process.platform === 'linux' ? ['--no-sandbox'] : [];
    return electron.launch({
      executablePath,
      args: [...sandboxArgs, `--user-data-dir=${userDataDir}`],
      env,
    });
  }

  return electron.launch({
    args: [`--user-data-dir=${userDataDir}`, REPO_ROOT],
    env,
  });
}

/**
 * Returns the main window once the app shell is rendered. Waiting only for
 * `domcontentloaded` is not enough: the window commits a second navigation
 * right after the first load, and a `page.evaluate` issued in between fails
 * with "Execution context was destroyed".
 */
export async function mainWindow(app: ElectronApplication): Promise<Page> {
  const window = await app.firstWindow();
  await window.waitForLoadState('load');
  await window
    .locator('aside.sidebar')
    .waitFor({ state: 'visible', timeout: 30_000 });
  return window;
}
