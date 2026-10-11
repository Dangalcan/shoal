import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { launchApp, mainWindow } from '../fixtures/launch';

/**
 * Captures the README and landing page screenshots (`npm run screenshots`).
 *
 * Not part of `npm run test:e2e`. It needs the kind cluster `shoal-demo` with
 * `demo-workload.yaml` applied, KUBECONFIG pointing at a file that only holds
 * that cluster so no other context shows up, and SHOAL_E2E_EXECUTABLE set to a
 * packaged build: a dev run also lists every plugin checked out under
 * plugins/, while users only get the two bundled ones. Setup in
 * docs/E2E-TESTS.md.
 */

const OUT_DIR = path.resolve(__dirname, '../../docs/images');
// Logical pixels; small enough to fit a 1080p screen at 125 % scaling.
const WIDTH = 1280;
const HEIGHT = 720;
const CONTEXT = 'kind-shoal-demo';
const MANIFEST_NAME = 'web-settings';
const MANIFEST_YAML = `apiVersion: v1
kind: ConfigMap
metadata:
  name: web-settings
  namespace: demo
data:
  GREETING: hello from shoal
  LOG_LEVEL: info
`;

let app: ElectronApplication;
let window: Page;

async function setTheme(theme: 'light' | 'dark') {
  const html = window.locator('html');
  if ((await html.getAttribute('data-theme')) !== theme) {
    await window.locator('.theme-toggle').click();
  }
  await expect(html).toHaveAttribute('data-theme', theme);
}

async function shoot(name: string, theme: string) {
  // Let data loads, toasts and transitions settle before the capture.
  await expect(window.locator('[data-sonner-toast]')).toHaveCount(0, {
    timeout: 15_000,
  });
  await window.waitForTimeout(1500);
  await window.screenshot({
    path: path.join(OUT_DIR, `${name}-${theme}.png`),
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  });
}

test.beforeAll(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  app = await launchApp();
  window = await mainWindow(app);
  await app.evaluate(
    ({ BrowserWindow }, size) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.setContentSize(size.width, size.height);
      win.center();
    },
    { width: WIDTH, height: HEIGHT }
  );

  // A saved manifest for the Manifests screen.
  await window.getByRole('link', { name: 'Manifests' }).click();
  await window.getByRole('button', { name: 'New Manifest' }).click();
  await window.locator('#manifest-name').fill(MANIFEST_NAME);
  await window.locator('#manifest-content').fill(MANIFEST_YAML);
  await window.getByRole('button', { name: 'Save Manifest' }).click();
  await expect(
    window.locator('.manifest-card', { hasText: MANIFEST_NAME })
  ).toBeVisible();
});

test.afterAll(async () => {
  await app?.close();
});

for (const theme of ['light', 'dark'] as const) {
  test(`captures every screen in ${theme} mode`, async () => {
    test.setTimeout(300_000);
    await setTheme(theme);

    await window.getByRole('link', { name: 'Dashboard' }).click();
    await expect(window.locator('.dashboard-title')).toBeVisible();
    await expect(window.getByText(CONTEXT).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(window.getByText('Checking...')).toHaveCount(0, {
      timeout: 30_000,
    });
    await shoot('dashboard', theme);

    await window.getByRole('link', { name: 'Clusters' }).click();
    const card = window.locator('.cluster-card', { hasText: CONTEXT });
    await expect(card).toBeVisible({ timeout: 30_000 });

    await card.locator('.cluster-card-info').click();
    await expect(window.locator('.cluster-details-container')).toBeVisible();
    await window.locator('#namespace-selector').selectOption('demo');
    await expect(window.getByText(/^web-/).first()).toBeVisible({
      timeout: 30_000,
    });
    await shoot('cluster-details', theme);

    await window.getByRole('link', { name: 'Manifests' }).click();
    await expect(
      window.locator('.manifest-card', { hasText: MANIFEST_NAME })
    ).toBeVisible();
    await shoot('manifests', theme);

    await window.getByRole('link', { name: 'Plugins' }).click();
    await expect(window.locator('.plugins__title')).toBeVisible();
    await shoot('plugins', theme);
  });
}
