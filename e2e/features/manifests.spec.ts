import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { launchApp, mainWindow } from '../fixtures/launch';
import path from 'path';
import os from 'os';
import fs from 'fs';

/**
 * Manifest Manager flows: create/edit/delete a manifest, load an example
 * template, and folder management. No cluster required (apply is not tested).
 *
 * The app is launched with an isolated, throwaway userData directory (via the
 * Electron `--user-data-dir` switch) so the manifest SQLite database starts
 * empty every run. Manifests persist in that database, so without isolation
 * failed runs would leave rows behind that accumulate over time — bloating the
 * (unvirtualized) card grid until hovers and re-renders exceed their timeouts.
 */

const RUN_ID = Date.now().toString(36);
const MANIFEST_NAME = `e2e-manifest-${RUN_ID}`;
const FOLDER_NAME = `e2e-folder-${RUN_ID}`;

let userDataDir: string;

const SAMPLE_YAML = `apiVersion: v1
kind: ConfigMap
metadata:
  name: e2e-config
data:
  key: value
`;

let app: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-e2e-manifests-'));
  app = await launchApp({ userDataDir });
  window = await mainWindow(app);

  await window.getByRole('link', { name: 'Manifests' }).click();
  await expect(
    window.locator('h1', { hasText: 'Manifest Manager' })
  ).toBeVisible();
});

test.afterAll(async () => {
  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

test('creates a manifest through the editor modal', async () => {
  await window.getByRole('button', { name: 'New Manifest' }).click();
  await expect(
    window.locator('.base-modal-title', { hasText: 'Create New Manifest' })
  ).toBeVisible();

  await window.locator('#manifest-name').fill(MANIFEST_NAME);
  await window.locator('#manifest-content').fill(SAMPLE_YAML);
  await window.getByRole('button', { name: 'Save Manifest' }).click();

  await expect(
    window.locator('.manifest-card', { hasText: MANIFEST_NAME })
  ).toBeVisible();
});

test('save button stays disabled while the form is incomplete', async () => {
  await window.getByRole('button', { name: 'New Manifest' }).click();

  const save = window.getByRole('button', { name: 'Save Manifest' });
  await expect(save).toBeDisabled();

  await window.locator('#manifest-name').fill('only-a-name');
  await expect(save).toBeDisabled();

  await window.locator('#manifest-content').fill('kind: ConfigMap');
  await expect(save).toBeEnabled();

  // Close without saving.
  await window.getByRole('button', { name: 'Cancel' }).click();
  await expect(
    window.locator('.manifest-card', { hasText: 'only-a-name' })
  ).not.toBeVisible();
});

test('edits an existing manifest', async () => {
  const card = window.locator('.manifest-card', { hasText: MANIFEST_NAME });
  await card.hover();
  await card.locator('button[title="Edit Manifest"]').click();

  await expect(
    window.locator('.base-modal-title', { hasText: 'Edit Manifest' })
  ).toBeVisible();
  // The editor is pre-filled with the saved content.
  await expect(window.locator('#manifest-content')).toHaveValue(
    /kind: ConfigMap/
  );

  await window
    .locator('#manifest-content')
    .fill(SAMPLE_YAML + '  extra: added\n');
  await window.getByRole('button', { name: 'Update Manifest' }).click();

  await expect(window.locator('.base-modal-title')).not.toBeVisible();
  await expect(card).toBeVisible();
});

test('example template pre-fills the create modal', async () => {
  await window.getByRole('button', { name: 'Examples' }).click();
  await expect(
    window.locator('.base-modal-title', { hasText: 'Example Manifests' })
  ).toBeVisible();

  // Pick the first template and remember its name.
  const first = window.locator('.example-templates__item').first();
  const templateName = await first
    .locator('.example-templates__name')
    .innerText();
  await first.click();

  // The create modal opens pre-filled with the template.
  await expect(
    window.locator('.base-modal-title', { hasText: 'Create New Manifest' })
  ).toBeVisible();
  await expect(window.locator('#manifest-name')).toHaveValue(templateName);
  const content = await window.locator('#manifest-content').inputValue();
  expect(content.length).toBeGreaterThan(0);

  // Close without saving.
  await window.getByRole('button', { name: 'Cancel' }).click();
});

test('creates a folder, opens it, and navigates back via breadcrumbs', async () => {
  await window.getByRole('button', { name: 'New Folder' }).click();
  await expect(
    window.locator('.base-modal-title', { hasText: 'New Folder' })
  ).toBeVisible();
  await window
    .locator('input[placeholder="e.g., Production Deployments"]')
    .fill(FOLDER_NAME);
  await window.getByRole('button', { name: 'Create', exact: true }).click();

  const folderCard = window.locator('.folder-card', { hasText: FOLDER_NAME });
  await expect(folderCard).toBeVisible();

  // Enter the folder: it is empty, our root manifest is not visible inside.
  await folderCard.click();
  await expect(
    window.locator('.manifest-card', { hasText: MANIFEST_NAME })
  ).not.toBeVisible();

  // Breadcrumb back to the root.
  await window.locator('.folder-breadcrumbs__crumb').first().click();
  await expect(
    window.locator('.manifest-card', { hasText: MANIFEST_NAME })
  ).toBeVisible();
});

test('deletes the folder and the manifest', async () => {
  // Delete the folder.
  const folderCard = window.locator('.folder-card', { hasText: FOLDER_NAME });
  await folderCard.hover();
  await folderCard.locator('button[title="Delete Folder"]').click();
  await expect(
    window.locator('.base-modal-title', { hasText: 'Delete Folder' })
  ).toBeVisible();
  // Scope to the modal: the folder card's own delete icon shares the
  // accessible name "Delete Folder".
  await window
    .locator('.base-modal-overlay')
    .locator('button.btn--danger', { hasText: 'Delete Folder' })
    .click();
  await expect(folderCard).not.toBeVisible();

  // Delete the manifest.
  const card = window.locator('.manifest-card', { hasText: MANIFEST_NAME });
  await card.hover();
  await card.locator('button[title="Delete"]').click();
  await expect(window.locator('.confirm-modal-body')).toBeVisible();
  await window.getByRole('button', { name: 'Delete Manifest' }).last().click();
  await expect(card).not.toBeVisible();
});
