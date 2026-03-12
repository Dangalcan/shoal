import { test, expect } from '../fixtures/app.fixture';

const CLUSTER_NAME = 'e2e-test-cluster';

/**
 * Full lifecycle test: create a cluster, then delete it.
 *
 * Prerequisites:
 *   - kubectl in PATH
 *   - kind OR k3d installed
 *   - App built: npm run build:react && npm run build:electron
 *
 * Run with:
 *   npm run test:e2e
 */
test('create and delete a cluster', async ({ window }) => {
  // ── 1. Navigate to Clusters page ────────────────────────────────────────
  await window.getByRole('link', { name: 'Clusters' }).click();
  await expect(window.locator('.clusters-title')).toBeVisible();

  // ── 2. Open Create Cluster form ──────────────────────────────────────────
  await window.getByRole('button', { name: 'Create Cluster' }).click();
  await expect(window.locator('.create-cluster-form')).toBeVisible();

  // ── 3. Fill in cluster name ──────────────────────────────────────────────
  const nameInput = window.locator(
    'input.form-input[placeholder="my-cluster"]'
  );
  await nameInput.fill(CLUSTER_NAME);

  // ── 4. Select provider (kind) ────────────────────────────────────────────
  await window.locator('.provider-button', { hasText: 'kind' }).click();
  await expect(
    window.locator('.provider-button-selected', { hasText: 'kind' })
  ).toBeVisible();

  // ── 5. Submit — cluster creation can take 1-3 minutes ───────────────────
  await window.getByRole('button', { name: 'Create Cluster' }).click();
  await expect(window.locator('.clusters-title')).toBeVisible({
    timeout: 180_000,
  });

  // ── 6. Verify the cluster card appeared ─────────────────────────────────
  const clusterCard = window.locator('.cluster-card', {
    hasText: CLUSTER_NAME,
  });
  await expect(clusterCard).toBeVisible({ timeout: 10_000 });

  // ── 7. Click the Delete button (trash icon) on the card ─────────────────
  await clusterCard.locator('.delete-cluster-button').click();

  // ── 8. Confirm deletion in the modal ────────────────────────────────────
  await expect(window.locator('.confirm-modal-body')).toBeVisible();
  await expect(window.locator('.confirm-modal-title')).toHaveText(
    'Delete Cluster'
  );
  await window.getByRole('button', { name: 'Delete Cluster' }).last().click();

  // ── 9. Verify the cluster is gone ────────────────────────────────────────
  await expect(clusterCard).not.toBeVisible({ timeout: 30_000 });
});
