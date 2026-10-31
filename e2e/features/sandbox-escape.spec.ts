import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { launchApp, mainWindow } from '../fixtures/launch';

/**
 * Plugin sandbox under a hostile plugin.
 *
 * The fixture plugin in e2e/fixtures/plugins/escape-probe declares no
 * permissions and, once its page is open, tries to get out of its frame:
 * the host DOM, top-level navigation, window.open, fetch, XHR, WebSocket,
 * the clipboard, Node globals and bridge calls beyond its permissions. It
 * prints one `name=outcome` line per probe; every outcome must be
 * `blocked`. The spec then asks the frame to navigate itself to an outside
 * URL, which the host document's CSP refuses.
 *
 * Dev builds load the unsigned fixture (ALLOW_UNSIGNED_PLUGINS). Packaged
 * builds ignore that flag, so against SHOAL_E2E_EXECUTABLE the spec checks
 * the opposite: the unsigned plugin is listed as an error that explains the
 * missing signature and none of its code is loaded.
 */

const PLUGIN_ID = 'escape-probe';
const PLUGIN_NAME = 'Escape Probe';
const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/plugins', PLUGIN_ID);
const PACKAGED = Boolean(process.env.SHOAL_E2E_EXECUTABLE);
const OUTSIDE_URL = 'https://escape-probe.invalid/';

const EXPECTED_BLOCKED = [
  'parent-dom',
  'top-navigation',
  'window-open',
  'node-globals',
  'raw-ipc',
  'fetch',
  'xhr',
  'websocket',
  'sdk-permission',
  'shim-permission',
  'clipboard-read',
];

let app: ElectronApplication;
let window: Page;
const consoleErrors: string[] = [];

test.beforeAll(async () => {
  // A user-installed copy of the fixture, discovered on first start.
  const userDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'shoal-e2e-escape-')
  );
  fs.cpSync(FIXTURE_DIR, path.join(userDataDir, 'plugins', PLUGIN_ID), {
    recursive: true,
  });

  app = await launchApp({ userDataDir });
  window = await mainWindow(app);
  window.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await window.getByRole('link', { name: 'Plugins' }).click();
  await expect(window.locator('.plugins__title')).toBeVisible();
});

test.afterAll(async () => {
  await app.close();
});

function pluginCard() {
  return window.locator('.plugin-card', { hasText: PLUGIN_NAME });
}

function pluginHostFrame() {
  return window
    .frames()
    .find((frame) => frame.url().includes('plugin-host/index.html'));
}

test('a packaged build does not load the unsigned plugin', async () => {
  test.skip(!PACKAGED, 'dev builds load unsigned plugins on purpose');

  // The bundled (signed) plugins are there. The unsigned fixture is listed
  // too, but as an error that explains the missing signature: the loader
  // registers it without loading any of its code, so the user sees why it
  // does not run instead of a plugin that silently disappears.
  await expect(
    window.locator('.plugin-card', { hasText: 'Resource Monitor' })
  ).toBeVisible({ timeout: 15_000 });
  await expect(pluginCard()).toHaveCount(1);
  await expect(pluginCard().locator('.plugin-card__error')).toContainText(
    'not signed'
  );
  await expect(pluginCard().locator('.plugin-state')).toHaveText('Error');
  expect(pluginHostFrame()).toBeUndefined();
});

test('every escape attempt from the plugin frame is blocked', async () => {
  test.skip(PACKAGED, 'needs the unsigned fixture plugin (dev build only)');

  // User-installed plugins start disabled.
  const card = pluginCard();
  await expect(card).toBeVisible({ timeout: 15_000 });
  const toggle = card
    .locator('button')
    .filter({ hasText: /^(Enable|Disable)$/ })
    .first();
  if ((await toggle.innerText()).trim() === 'Enable') {
    await toggle.click();
  }
  await expect(card.locator('.plugin-state')).toHaveText('Enabled', {
    timeout: 20_000,
  });

  // Open the plugin page (HashRouter) and wait for the probes to finish.
  await window.evaluate(() => {
    globalThis.location.hash = '#/plugin/escape-probe';
  });
  const results = window
    .frameLocator('.plugin-page-container iframe')
    .locator('[data-testid="escape-probe-results"]');
  await expect(results).toContainText('done=true', { timeout: 60_000 });

  // Auto-retrying assertions: the frame may still be settling.
  for (const probe of EXPECTED_BLOCKED) {
    await expect(results, `probe ${probe}`).toContainText(`${probe}=blocked`);
  }
  // The network probes were stopped by the frame CSP, not by DNS.
  await expect(results).toContainText(/csp-violations=.*connect-src/);

  // window.open and the top-level navigation attempt left the host alone.
  expect(app.windows()).toHaveLength(1);
  expect(window.url()).toContain('#/plugin/escape-probe');
});

test('the frame cannot navigate itself to an outside URL', async () => {
  test.skip(PACKAGED, 'needs the unsigned fixture plugin (dev build only)');

  const frame = pluginHostFrame();
  expect(frame, 'plugin host document loaded').toBeDefined();

  // The attempt replaces the frame's document, so the evaluation may end
  // with a destroyed context: that is expected.
  await frame!
    .evaluate((url) => {
      globalThis.location.href = url;
    }, OUTSIDE_URL)
    .catch(() => undefined);

  // The host document's CSP (frame-src) refuses it; nothing from outside
  // loads and the host stays where it was.
  await expect
    .poll(() =>
      consoleErrors.some(
        (text) =>
          text.includes(`Framing '${OUTSIDE_URL}'`) &&
          text.includes('frame-src')
      )
    )
    .toBe(true);
  for (const child of window.frames()) {
    expect(child.url()).not.toContain('escape-probe.invalid');
  }
  expect(app.windows()).toHaveLength(1);
  expect(window.url()).toContain('#/plugin/escape-probe');
});
