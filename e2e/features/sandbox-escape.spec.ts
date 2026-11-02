import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { launchApp, mainWindow } from '../fixtures/launch';
import { toPluginFileUrl } from '../../electron/shared/plugin-file-url';

/**
 * Plugin sandbox under a hostile plugin.
 *
 * The fixture plugin in e2e/fixtures/plugins/escape-probe declares no
 * permissions and, once its page is open, tries to get out of its frame:
 * the host DOM, top-level navigation, window.open, fetch, XHR, WebSocket,
 * WebRTC, the clipboard, Node globals and bridge calls beyond its permissions.
 * It prints one `name=outcome` line per probe; every outcome must be
 * `blocked`. The spec then asks the frame to move to a host document of its
 * own, which the main process refuses, and to an outside URL, which the host
 * document's CSP refuses.
 *
 * Dev builds load the unsigned fixture (ALLOW_UNSIGNED_PLUGINS). Packaged
 * builds ignore that flag, so against SHOAL_E2E_EXECUTABLE the spec checks
 * the opposite: the unsigned plugin is listed as an error that explains the
 * missing signature, and neither Enable nor a start-up with it saved as
 * enabled runs any of its code.
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
  'webrtc',
  'webrtc-nested',
  'sdk-permission',
  'shim-permission',
  'clipboard-read',
];

/** A new user data directory holding a user-installed copy of the fixture. */
function installFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-e2e-escape-'));
  fs.cpSync(FIXTURE_DIR, path.join(dir, 'plugins', PLUGIN_ID), {
    recursive: true,
  });
  return dir;
}

function mainLog(dir: string): string {
  return fs.readFileSync(path.join(dir, 'logs', 'main.log'), 'utf8');
}

/** The log line of a hook that really ran. */
function ranActivate(dir: string): boolean {
  return mainLog(dir).includes(`Executing activate for ${PLUGIN_ID}`);
}

let app: ElectronApplication;
let window: Page;
let userDataDir: string;
const consoleErrors: string[] = [];

test.beforeAll(async () => {
  // A user-installed copy of the fixture, discovered on first start.
  userDataDir = installFixture();

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

  // The card offers no Enable, and the main process refuses the call as well.
  await expect(
    pluginCard().getByRole('button', { name: 'Enable' })
  ).toBeDisabled();
  const result = await window.evaluate(
    (id) =>
      (
        globalThis as unknown as {
          electron: {
            enablePlugin(id: string): Promise<{
              success: boolean;
              error?: string;
            }>;
          };
        }
      ).electron.enablePlugin(id),
    PLUGIN_ID
  );
  expect(result.success).toBe(false);
  expect(result.error).toContain('not signed');
  await expect(pluginCard().locator('.plugin-state')).toHaveText('Error');
  expect(ranActivate(userDataDir)).toBe(false);
});

test('a packaged build does not start an unsigned plugin saved as enabled', async () => {
  test.skip(!PACKAGED, 'dev builds load unsigned plugins on purpose');

  const dir = installFixture();
  fs.writeFileSync(
    path.join(dir, 'plugin-config.json'),
    JSON.stringify({ [PLUGIN_ID]: { enabled: true, settings: {} } })
  );
  const second = await launchApp({ userDataDir: dir });
  try {
    const page = await mainWindow(second);
    await page.getByRole('link', { name: 'Plugins' }).click();
    const card = page.locator('.plugin-card', { hasText: PLUGIN_NAME });

    // The card reads Error from discovery on, so a look at it proves nothing
    // until start-up has been through the enabled plugins.
    await expect
      .poll(() => mainLog(dir), { timeout: 30_000 })
      .toContain('Plugin system initialized');

    expect(ranActivate(dir)).toBe(false);
    await expect(card.locator('.plugin-state')).toHaveText('Error');
    await expect(card.locator('.plugin-card__error')).toContainText(
      'not signed'
    );
  } finally {
    await second.close();
  }
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

test('the frame cannot move to a host document of its own', async () => {
  test.skip(PACKAGED, 'needs the unsigned fixture plugin (dev build only)');

  const frame = pluginHostFrame();
  expect(frame, 'plugin host document loaded').toBeDefined();
  const ownDocument = toPluginFileUrl(
    path.join(userDataDir, 'plugins', PLUGIN_ID, 'plugin-host', 'index.html')
  );

  await frame!
    .evaluate((url) => {
      globalThis.location.href = url;
    }, ownDocument)
    .catch(() => undefined);

  await expect
    .poll(() => mainLog(userDataDir))
    .toContain(`Blocked frame navigation to ${ownDocument}`);
  const content = window.frameLocator('.plugin-page-container iframe');
  await expect(content.getByTestId('own-host-document')).toHaveCount(0);
  await expect(
    content.locator('[data-testid="escape-probe-results"]')
  ).toContainText('done=true');
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
