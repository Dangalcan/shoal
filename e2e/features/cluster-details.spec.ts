import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { launchApp, mainWindow } from '../fixtures/launch';

const CLUSTER_NAME = 'details-test-cluster';

let app: ElectronApplication;
let window: Page;

// ─────────────────────────────────────────────────────────────────────────────
// Shared setup: one app instance, one cluster for the whole suite
// ─────────────────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  app = await launchApp();
  window = await mainWindow(app);

  // ── Create the cluster ───────────────────────────────────────────────────
  await window.getByRole('link', { name: 'Clusters' }).click();
  await expect(window.locator('.clusters-title')).toBeVisible();

  await window.getByRole('button', { name: 'Create Cluster' }).click();
  await window
    .locator('input.form-input[placeholder="my-cluster"]')
    .fill(CLUSTER_NAME);
  await window.locator('.provider-button', { hasText: 'kind' }).click();
  await window.getByRole('button', { name: 'Create Cluster' }).click();

  // Wait for creation (kind can be slow)
  await expect(window.locator('.clusters-title')).toBeVisible({
    timeout: 180_000,
  });
  const clusterCard = window.locator('.cluster-card', {
    hasText: CLUSTER_NAME,
  });
  await expect(clusterCard).toBeVisible({ timeout: 10_000 });

  // ── Navigate into cluster details ────────────────────────────────────────
  await clusterCard.locator('.cluster-card-info').click();
  await expect(window.locator('.cluster-details-container')).toBeVisible();
});

test.afterAll(async () => {
  // ── Go back and delete the cluster ───────────────────────────────────────
  // A test that failed with a modal open would otherwise block the sidebar
  // and leave the cluster behind for the next spec (BaseModal closes on Escape).
  await window.keyboard.press('Escape');
  await window.getByRole('link', { name: 'Clusters' }).click();
  await expect(window.locator('.clusters-title')).toBeVisible();

  const clusterCard = window.locator('.cluster-card', {
    hasText: CLUSTER_NAME,
  });
  await clusterCard.locator('.delete-cluster-button').click();
  await expect(window.locator('.confirm-modal-body')).toBeVisible();
  await window.getByRole('button', { name: 'Delete Cluster' }).last().click();
  await expect(clusterCard).not.toBeVisible({ timeout: 30_000 });

  await app.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test('shows cluster name in the header', async () => {
  // kind prefixes the cluster name with "kind-", so we check for containment
  await expect(window.locator('.header-title-section h2')).toContainText(
    CLUSTER_NAME
  );
});

test('default active tab is Pods', async () => {
  await expect(
    window.locator('.tab-button-active', { hasText: 'Pods' })
  ).toBeVisible();
});

test('resource tabs switch between types', async () => {
  for (const tab of ['Deployments', 'Services', 'ConfigMaps', 'Pods']) {
    await window.locator('.tab-button', { hasText: tab }).click();
    await expect(
      window.locator('.tab-button-active', { hasText: tab })
    ).toBeVisible();
  }
});

test('namespace selector switches to kube-system and back', async () => {
  const selector = window.locator('#namespace-selector');
  await expect(selector).toBeVisible();

  await selector.selectOption('kube-system');
  await expect(selector).toHaveValue('kube-system');

  // kube-system always has pods in a kind cluster
  await expect(window.locator('.table-row').first()).toBeVisible({
    timeout: 15_000,
  });

  await selector.selectOption('all');
  await expect(selector).toHaveValue('all');
});

test('table sorts ascending and descending by Name column', async () => {
  await window.locator('.tab-button', { hasText: 'Pods' }).click();
  await expect(window.locator('.table-row').first()).toBeVisible({
    timeout: 15_000,
  });

  // First click → ascending sort (exact: true avoids matching "Namespace")
  await window.getByRole('columnheader', { name: 'Name', exact: true }).click();
  await expect(window.locator('.sort-icon').first()).toBeVisible();

  // Second click → descending sort
  await window.getByRole('columnheader', { name: 'Name', exact: true }).click();
  await expect(window.locator('.sort-icon').first()).toBeVisible();
});

test('table sorts by Namespace column', async () => {
  await window.locator('.tab-button', { hasText: 'Pods' }).click();
  await expect(window.locator('.table-row').first()).toBeVisible({
    timeout: 15_000,
  });

  await window
    .getByRole('columnheader', { name: 'Namespace', exact: true })
    .click();
  await expect(window.locator('.sort-icon').first()).toBeVisible();
});

test('row actions appear on hover', async () => {
  await window.locator('.tab-button', { hasText: 'Pods' }).click();
  await expect(window.locator('.table-row').first()).toBeVisible({
    timeout: 15_000,
  });

  await window.locator('.table-row').first().hover();
  await expect(window.locator('.action-button-describe').first()).toBeVisible();
  await expect(window.locator('.action-button-yaml').first()).toBeVisible();
  await expect(window.locator('.action-button-logs').first()).toBeVisible();
});

test('log viewer follows a pod and stops following on request', async () => {
  await window.locator('.tab-button', { hasText: 'Pods' }).click();
  // CoreDNS writes its version banner at startup, so the stream's first
  // batch (the last 200 lines) is never empty. The cluster was created a
  // moment ago and kind does not wait for CoreDNS: until its container
  // runs, `kubectl logs -f` only says "waiting to start" and gives up.
  const row = window
    .locator('.table-row', { hasText: 'coredns' })
    .filter({ hasText: 'Running' })
    .first();
  await expect(row).toBeVisible({ timeout: 120_000 });
  await row.hover();
  await row.locator('.action-button-logs').click();

  const modal = window.getByTestId('log-modal');
  await expect(modal).toBeVisible();
  const status = modal.getByTestId('log-stream-status');
  await expect(status).toContainText('Snapshot');

  const follow = modal.getByRole('button', { name: 'Follow' });
  await follow.click();
  await expect(follow).toHaveAttribute('aria-pressed', 'true');
  await expect(status).toContainText('Live', { timeout: 15_000 });
  await expect(modal.getByTestId('log-content')).toContainText('CoreDNS', {
    timeout: 15_000,
  });
  // Snapshot controls make no sense while the stream fills the viewer.
  await expect(
    modal.getByRole('button', { name: 'Auto-refresh' })
  ).not.toBeVisible();

  await follow.click();
  await expect(status).toContainText('Follow stopped');
  await expect(modal.getByTestId('log-content')).toContainText('CoreDNS');

  await modal.locator('.close-footer-button').click();
  await expect(modal).not.toBeVisible();
});

test('settings dropdown opens, filters resource list, and closes', async () => {
  await window.locator('button[title="Display Settings"]').click();
  await expect(window.locator('.settings-dropdown')).toBeVisible();

  // Type in the filter input
  await window.locator('.settings-search-input').fill('Deploy');
  await expect(
    window.locator('.settings-item-button', { hasText: 'Deployments' })
  ).toBeVisible();

  // Clear filter
  await window.locator('.settings-search-input').fill('');

  // Close via X button
  await window.locator('button[title="Close Settings"]').click();
  await expect(window.locator('.settings-dropdown')).not.toBeVisible();
});

test('settings dropdown toggles a resource tab on and off', async () => {
  await window.locator('button[title="Display Settings"]').click();
  await expect(window.locator('.settings-dropdown')).toBeVisible();

  const dropdown = window.locator('.settings-dropdown');

  // Use exact regex filter to avoid matching "CronJobs"
  const jobsItem = dropdown
    .locator('.settings-item-button')
    .filter({ hasText: /^Jobs$/ });
  const jobsToggle = jobsItem.locator('.settings-toggle');

  // Jobs is hidden by default (defaultHidden in resource-configs), but a
  // reused profile may have it on: assert the flip, not a fixed start state.
  const startsOn = /settings-toggle-on/.test(
    (await jobsToggle.getAttribute('class')) ?? ''
  );
  const initial = startsOn ? /settings-toggle-on/ : /settings-toggle-off/;
  const flipped = startsOn ? /settings-toggle-off/ : /settings-toggle-on/;

  // Toggle → CSS class on the switch changes immediately (direct, reliable)
  await jobsItem.click();
  await expect(jobsToggle).toHaveClass(flipped);

  // Toggle back to the starting state
  await jobsItem.click();
  await expect(jobsToggle).toHaveClass(initial);

  await window.locator('button[title="Close Settings"]').click();
});

test('settings dropdown shows column toggles for active tab', async () => {
  // Switch to Deployments so we get deployment-specific columns
  await window.locator('.tab-button', { hasText: 'Deployments' }).click();

  await window.locator('button[title="Display Settings"]').click();
  await expect(window.locator('.settings-dropdown')).toBeVisible();

  // Columns section should mention the current tab
  await expect(
    window.locator('.settings-section-title', { hasText: 'Deployments' })
  ).toBeVisible();

  await window.locator('button[title="Close Settings"]').click();

  // Back to Pods for remaining tests
  await window.locator('.tab-button', { hasText: 'Pods' }).click();
});
