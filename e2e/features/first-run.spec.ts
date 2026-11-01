import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { launchApp, mainWindow } from '../fixtures/launch';
import {
  EMPTY_KUBECONFIG,
  unreachableKubeconfig,
  writeKubeconfig,
} from '../fixtures/kubeconfig';
import { extraToolDirs } from '../../electron/utils/path-env';

/**
 * First run against what a newcomer may have: a kubeconfig without any
 * context, one whose context points at an address that never answers, and
 * no kubectl at all. No cluster is needed; the first two groups need kubectl
 * installed (it is on the CI runners), the third hides it.
 */

const UNREACHABLE_KUBECONFIG = unreachableKubeconfig('unreachable');

test.describe('empty kubeconfig', () => {
  let app: ElectronApplication;
  let window: Page;
  let dir: string;

  test.beforeAll(async () => {
    const kubeconfig = writeKubeconfig('empty', EMPTY_KUBECONFIG);
    dir = kubeconfig.dir;
    app = await launchApp({ env: { KUBECONFIG: kubeconfig.file } });
    window = await mainWindow(app);
  });

  test.afterAll(async () => {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('the dashboard says where contexts come from', async () => {
    await expect(window.locator('.dashboard-title')).toBeVisible();
    await expect(window.locator('.dashboard-empty-state__hint')).toContainText(
      'kubeconfig'
    );
  });

  test('the cluster list says how to add one', async () => {
    await window.getByRole('link', { name: 'Clusters' }).click();
    await expect(window.locator('.clusters-empty-title')).toHaveText(
      'No clusters found'
    );
    await expect(window.locator('.clusters-empty-subtitle')).toContainText(
      'KUBECONFIG'
    );
  });

  test('nothing errors on an empty first run', async () => {
    await window.waitForTimeout(2000);
    expect(
      await window.locator('[data-sonner-toast][data-type="error"]').count()
    ).toBe(0);
  });
});

test.describe('unreachable current context', () => {
  let app: ElectronApplication;
  let window: Page;
  let dir: string;
  let launchMs = 0;

  test.beforeAll(async () => {
    const kubeconfig = writeKubeconfig('unreachable', UNREACHABLE_KUBECONFIG);
    dir = kubeconfig.dir;
    const started = Date.now();
    app = await launchApp({ env: { KUBECONFIG: kubeconfig.file } });
    window = await mainWindow(app);
    launchMs = Date.now() - started;
  });

  test.afterAll(async () => {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('the window opens without waiting for the cluster', async () => {
    // The bundled Namespace Watcher runs kubectl while it activates; the
    // window used to wait for it (up to the 30-second kubectl timeout).
    expect(launchMs).toBeLessThan(20_000);
    await expect(window.locator('.dashboard-title')).toBeVisible();
  });

  test('cluster details settle on an error instead of looping', async () => {
    test.setTimeout(120_000);
    await window.getByRole('link', { name: 'Clusters' }).click();
    const card = window.locator('.cluster-card', { hasText: 'unreachable' });
    await expect(card).toBeVisible();
    await card.locator('.cluster-card-info').click();

    const error = window.locator('.error-state');
    await expect(error).toBeVisible({ timeout: 45_000 });
    // Longer than one auto-refresh interval (10 s): the panel must stay.
    await window.waitForTimeout(15_000);
    await expect(error).toBeVisible();
    await expect(window.locator('.loading-state')).toHaveCount(0);
  });
});

interface HiddenKubectl {
  /** The launch PATH: every folder that held a kubectl replaced by a mirror. */
  PATH: string;
  /** The mirror folders, in PATH order. Empty when no kubectl was found. */
  mirrors: string[];
  /** The real binary the first mirror hid, to "install" it again. */
  kubectl: string | null;
}

function kubectlIn(dir: string): string | null {
  const file = path.join(dir, 'kubectl');
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return file;
  } catch {
    return null;
  }
}

/**
 * Hides kubectl from the app without touching the machine: every PATH folder
 * that holds one is replaced by a folder of symlinks to everything else in
 * it, so the main process meets the genuine ENOENT while its child processes
 * keep every other tool. Returns null when kubectl lives in a folder
 * path-env.ts appends on its own; that one cannot be hidden.
 */
function hideKubectl(root: string): HiddenKubectl | null {
  if (extraToolDirs(process.platform, os.homedir()).some(kubectlIn)) {
    return null;
  }
  const mirrors: string[] = [];
  let kubectl: string | null = null;
  const entries = (process.env.PATH ?? '')
    .split(path.delimiter)
    .filter(Boolean);
  const PATH = entries
    .map((dir, index) => {
      const found = kubectlIn(dir);
      if (!found) return dir;
      kubectl ??= found;
      const mirror = path.join(root, `bin-${index}`);
      fs.mkdirSync(mirror);
      for (const name of fs.readdirSync(dir)) {
        if (name === 'kubectl') continue;
        fs.symlinkSync(path.join(dir, name), path.join(mirror, name));
      }
      mirrors.push(mirror);
      return mirror;
    })
    .join(path.delimiter);
  return { PATH, mirrors, kubectl };
}

test.describe('kubectl missing', () => {
  // Before every probe the main process re-reads the registry PATH on
  // Windows and finds an installed kubectl again whatever the launch PATH
  // says, so this group only runs on Linux and macOS.
  test.skip(
    process.platform === 'win32',
    'the registry PATH refresh brings kubectl back on Windows'
  );

  let app: ElectronApplication;
  let window: Page;
  let root: string;
  let kubeconfigDir: string;
  let hidden: HiddenKubectl;

  test.beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-nokubectl-'));
    const result = hideKubectl(root);
    test.skip(
      result === null,
      'kubectl lives in a folder Shoal adds to the PATH by itself'
    );
    hidden = result as HiddenKubectl;
    const kubeconfig = writeKubeconfig('nokubectl', EMPTY_KUBECONFIG);
    kubeconfigDir = kubeconfig.dir;
    app = await launchApp({
      env: { PATH: hidden.PATH, KUBECONFIG: kubeconfig.file },
    });
    window = await mainWindow(app);
  });

  test.afterAll(async () => {
    if (app) await app.close();
    fs.rmSync(root, { recursive: true, force: true });
    if (kubeconfigDir) {
      fs.rmSync(kubeconfigDir, { recursive: true, force: true });
    }
  });

  test('the dashboard explains it once, without an error toast', async () => {
    const notice = window.locator('.tool-missing');
    await expect(notice).toBeVisible({ timeout: 15_000 });
    await expect(notice.locator('.tool-missing__title')).toHaveText(
      'kubectl not found'
    );
    await expect(
      notice.getByRole('button', { name: 'Install instructions' })
    ).toBeVisible();
    await expect(
      notice.getByRole('button', { name: 'Check again' })
    ).toBeVisible();
    // The main process reports the spawn failure as "not installed or not
    // on the PATH"; the pages explain that once instead of toasting it.
    await window.waitForTimeout(2000);
    expect(
      await window.locator('[data-sonner-toast][data-type="error"]').count()
    ).toBe(0);
  });

  test('the cluster list shows the same notice', async () => {
    await window.getByRole('link', { name: 'Clusters' }).click();
    await expect(window.locator('.tool-missing')).toBeVisible();
    await expect(window.locator('.clusters-empty-title')).toHaveText(
      'No clusters found'
    );
    expect(
      await window.locator('[data-sonner-toast][data-type="error"]').count()
    ).toBe(0);
  });

  test('"Check again" picks kubectl up once it is installed', async () => {
    test.skip(
      hidden.kubectl === null,
      'kubectl is not installed on this machine'
    );
    // "Install" it: the first mirror folder gets the real binary back, and
    // the app must notice without a restart.
    fs.symlinkSync(
      hidden.kubectl as string,
      path.join(hidden.mirrors[0], 'kubectl')
    );
    await window.getByRole('button', { name: 'Check again' }).click();
    await expect(window.locator('.tool-missing')).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(window.locator('.clusters-empty-title')).toHaveText(
      'No clusters found'
    );
    await window.waitForTimeout(2000);
    expect(
      await window.locator('[data-sonner-toast][data-type="error"]').count()
    ).toBe(0);
  });
});
