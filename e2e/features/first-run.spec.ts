import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { launchApp, mainWindow } from '../fixtures/launch';

/**
 * First run against kubeconfigs a newcomer may have: one without any context
 * and one whose context points at an address that never answers. No cluster
 * is needed; kubectl must be installed (it is on the CI runners).
 */

function writeKubeconfig(
  name: string,
  content: string
): {
  dir: string;
  file: string;
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `shoal-${name}-`));
  const file = path.join(dir, 'config');
  fs.writeFileSync(file, content);
  return { dir, file };
}

const EMPTY_KUBECONFIG = [
  'apiVersion: v1',
  'kind: Config',
  'clusters: []',
  'contexts: []',
  'users: []',
  'current-context: ""',
  '',
].join('\n');

// TEST-NET-3 (RFC 5737) is never routed: the connection either hangs until
// a timeout or fails at once, depending on the network. Both are fine here.
const UNREACHABLE_KUBECONFIG = [
  'apiVersion: v1',
  'kind: Config',
  'clusters:',
  '  - name: nowhere',
  '    cluster:',
  '      server: https://203.0.113.1:6443',
  '      insecure-skip-tls-verify: true',
  'contexts:',
  '  - name: unreachable',
  '    context:',
  '      cluster: nowhere',
  '      user: nobody',
  'users:',
  '  - name: nobody',
  '    user:',
  '      token: not-a-real-token',
  'current-context: unreachable',
  '',
].join('\n');

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
