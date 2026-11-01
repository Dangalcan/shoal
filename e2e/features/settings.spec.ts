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
import type { KubeconfigFile } from '../fixtures/kubeconfig';

/**
 * Settings page: About & Support, a custom kubeconfig path, and the local
 * preferences, all of which must survive a restart. No cluster is needed:
 * the app starts on an empty kubeconfig and switches to one whose only
 * context is listed but never selected, so nothing waits on a network.
 *
 * Both launches share one user data directory, like two runs of an
 * installed app.
 */

const PACKAGED = Boolean(process.env.SHOAL_E2E_EXECUTABLE);
const VERSION = (
  JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
  ) as { version: string }
).version;
const ALT_CONTEXT = 'e2e-settings-alternative';

let userDataDir: string;
let startup: KubeconfigFile;
let alternative: KubeconfigFile;
let app: ElectronApplication;
let window: Page;

async function launch(): Promise<void> {
  app = await launchApp({
    userDataDir,
    env: { KUBECONFIG: startup.file },
  });
  window = await mainWindow(app);
  await window.getByRole('link', { name: 'Settings' }).click();
  await expect(window.locator('.settings-page__title')).toBeVisible();
}

function toast(text: string) {
  return window.locator('[data-sonner-toast]', { hasText: text });
}

test.beforeAll(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-e2e-settings-'));
  startup = writeKubeconfig('settings-startup', EMPTY_KUBECONFIG);
  // Port 1 refuses at once if anything ever dials it.
  alternative = writeKubeconfig(
    'settings-alternative',
    unreachableKubeconfig(ALT_CONTEXT, {
      server: 'https://127.0.0.1:1',
      currentContext: false,
    })
  );
  await launch();
});

test.afterAll(async () => {
  await app?.close();
  for (const dir of [userDataDir, startup?.dir, alternative?.dir]) {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('About shows the running version and platform', async () => {
  await expect(window.locator('.settings-page')).toContainText(
    `Shoal v${VERSION} · ${process.platform}`
  );
});

test('the logs folder and the bug report open through the system shell', async () => {
  // Record what the main process hands to the OS instead of opening a file
  // manager and a browser on the machine running the tests.
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    (globalThis as { __e2eOpened?: string[] }).__e2eOpened = opened;
    shell.openPath = async (target: string) => {
      opened.push(`path:${target}`);
      return '';
    };
    shell.openExternal = async (url: string) => {
      opened.push(`url:${url}`);
    };
  });

  await window.getByRole('button', { name: 'Open logs folder' }).click();
  await window.getByRole('button', { name: 'Report a problem' }).click();

  await expect
    .poll(() =>
      app.evaluate(
        () => (globalThis as { __e2eOpened?: string[] }).__e2eOpened ?? []
      )
    )
    .toHaveLength(2);
  const [logs, report] = await app.evaluate(
    () => (globalThis as { __e2eOpened?: string[] }).__e2eOpened ?? []
  );

  // The folder that holds the log this very run is writing.
  expect(logs).toMatch(/^path:/);
  expect(fs.existsSync(path.join(logs.slice('path:'.length), 'main.log'))).toBe(
    true
  );

  // A prefilled issue on the project's tracker naming this version.
  const url = new URL(report.slice('url:'.length));
  expect(`${url.origin}${url.pathname}`).toBe(
    'https://github.com/Dangalcan/shoal/issues/new'
  );
  expect(url.searchParams.get('template')).toBe('bug_report.yml');
  expect(url.searchParams.get('version')).toBe(`v${VERSION}`);
  expect(url.searchParams.get('os')).toBe(
    `${process.platform} ${process.arch}`
  );
  await expect(toast('Could not open the logs folder')).toHaveCount(0);
});

test('a development build says update checks need an installed build', async () => {
  test.skip(PACKAGED, 'an installed build really asks GitHub for updates');
  await window.getByRole('button', { name: 'Check for updates' }).click();
  await expect(
    toast('Update checks only run in installed builds')
  ).toBeVisible();
});

test('a kubeconfig path that does not exist is refused', async () => {
  const missing = path.join(alternative.dir, 'no-such-config');
  const input = window.getByLabel('Kubeconfig Path');
  await expect(input).toHaveValue(startup.file);

  await input.fill(missing);
  await window.getByRole('button', { name: 'Set', exact: true }).click();
  await expect(toast(`Kubeconfig file not found: ${missing}`)).toBeVisible();

  // Nothing changed: the clusters still come from the startup kubeconfig.
  await window.getByRole('link', { name: 'Clusters' }).click();
  await expect(window.locator('.clusters-empty-title')).toHaveText(
    'No clusters found'
  );
});

test('another kubeconfig path replaces the cluster list at once', async () => {
  await window.getByRole('link', { name: 'Settings' }).click();
  await window.getByLabel('Kubeconfig Path').fill(alternative.file);
  await window.getByRole('button', { name: 'Set', exact: true }).click();
  await expect(toast('Kubeconfig path updated successfully')).toBeVisible();

  await window.getByRole('link', { name: 'Clusters' }).click();
  await expect(
    window.locator('.cluster-card', { hasText: ALT_CONTEXT })
  ).toBeVisible();
});

test('local preferences are saved as they change', async () => {
  await window.getByRole('link', { name: 'Settings' }).click();
  const saved = window.locator('.settings-footer', {
    hasText: 'Settings saved.',
  });

  const autoRefresh = window.getByLabel('Auto-Refresh Data');
  const interval = window.getByLabel('Refresh Interval');
  const intervalGroup = window
    .locator('.settings-form__group')
    .filter({ has: interval });
  await expect(autoRefresh).toBeChecked();
  await expect(intervalGroup).not.toHaveClass(/settings-page--hidden/);

  // Keyboard on the slider: the input event a user produces.
  await interval.focus();
  await window.keyboard.press('End');
  await expect(interval).toHaveValue('60');
  await expect(window.locator('.settings-form__range-value')).toHaveText('60s');
  await expect(saved).toBeVisible();

  await autoRefresh.uncheck();
  await expect(intervalGroup).toHaveClass(/settings-page--hidden/);

  await window.getByLabel('Default Namespace').selectOption('default');

  await window.locator('.theme-toggle').click();
  await expect(saved).toBeVisible();
});

test('the kubeconfig path, preferences and theme survive a restart', async () => {
  const theme = await window.locator('html').getAttribute('data-theme');
  await app.close();
  // The same KUBECONFIG as the first launch: the saved path must win.
  await launch();

  await expect(window.getByLabel('Kubeconfig Path')).toHaveValue(
    alternative.file
  );
  await expect(window.getByLabel('Auto-Refresh Data')).not.toBeChecked();
  await expect(window.getByLabel('Refresh Interval')).toHaveValue('60');
  await expect(window.getByLabel('Default Namespace')).toHaveValue('default');
  await expect(window.locator('html')).toHaveAttribute(
    'data-theme',
    theme ?? ''
  );

  await window.getByRole('link', { name: 'Clusters' }).click();
  await expect(
    window.locator('.cluster-card', { hasText: ALT_CONTEXT })
  ).toBeVisible();
});
