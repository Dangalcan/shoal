import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'path';

/**
 * Plugins page: installed list renders, enable/disable round-trip on a
 * bundled free plugin, and the sidebar entry follows the enabled state.
 *
 * Uses resource-monitor (bundled, free, has a renderer page) so no
 * marketplace backend is needed. ALLOW_UNSIGNED_PLUGINS=true lets the
 * unsigned bundled plugins load.
 */

const PLUGIN_NAME = 'Resource Monitor';
// The sidebar entry label the plugin registers on activation.
const SIDEBAR_LABEL = 'Pod Monitor';

let app: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  app = await electron.launch({
    args: [path.resolve(__dirname, '../..')],
    env: { ...process.env, ALLOW_UNSIGNED_PLUGINS: 'true', NODE_ENV: 'test' },
  });
  window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  await window.getByRole('link', { name: 'Plugins' }).click();
  await expect(window.locator('.plugins__title')).toBeVisible();
});

test.afterAll(async () => {
  await app.close();
});

function pluginCard() {
  return window.locator('.plugin-card', { hasText: PLUGIN_NAME });
}

test('lists the bundled plugins', async () => {
  await expect(pluginCard()).toBeVisible({ timeout: 15_000 });
  const cardCount = await window.locator('.plugin-card').count();
  expect(cardCount).toBeGreaterThanOrEqual(1);
});

test('disable/enable round-trip updates state and sidebar', async () => {
  const card = pluginCard();
  const stateBadge = card.locator('.plugin-state');
  const toggle = card
    .locator('button')
    .filter({ hasText: /^(Enable|Disable)$/ })
    .first();

  // Normalize to enabled first if needed.
  if ((await toggle.innerText()).trim() === 'Enable') {
    await toggle.click();
    await expect(stateBadge).toHaveText('Enabled', { timeout: 20_000 });
  }

  // Enabled plugins with a renderer appear in the sidebar plugin section.
  await expect(
    window.locator('.sidebar-nav a', { hasText: SIDEBAR_LABEL })
  ).toBeVisible({ timeout: 10_000 });

  // Disable → state flips and the sidebar entry disappears.
  await toggle.click();
  await expect(stateBadge).toHaveText('Disabled', { timeout: 20_000 });
  await expect(
    window.locator('.sidebar-nav a', { hasText: SIDEBAR_LABEL })
  ).not.toBeVisible();

  // Re-enable → back in the sidebar.
  await toggle.click();
  await expect(stateBadge).toHaveText('Enabled', { timeout: 20_000 });
  await expect(
    window.locator('.sidebar-nav a', { hasText: SIDEBAR_LABEL })
  ).toBeVisible({ timeout: 10_000 });
});

test('enabled plugin page renders its sandboxed frame', async () => {
  await window.locator('.sidebar-nav a', { hasText: SIDEBAR_LABEL }).click();

  // The plugin UI is hosted in the sandboxed iframe; the host page mounts
  // the frame element (its inner document is opaque-origin by design).
  await expect(window.locator('iframe').first()).toBeVisible({
    timeout: 15_000,
  });
});
