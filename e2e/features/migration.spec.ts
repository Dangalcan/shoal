import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { launchApp, mainWindow } from '../fixtures/launch';
import { unreachableKubeconfig, writeKubeconfig } from '../fixtures/kubeconfig';
import type { KubeconfigFile } from '../fixtures/kubeconfig';

/**
 * Docker Compose migration: the page either explains that kompose is
 * missing or converts a real compose file with the real kompose, lets the
 * user review it and imports the result into the manifest library. Which of
 * the two runs depends on the machine (the CI runners have no kompose); the
 * other one is skipped. No cluster is needed: the import only needs a
 * current context to label the manifests with.
 *
 * The native file picker is replaced in the main process by one that answers
 * with the compose file written here.
 */

const RUN_ID = Date.now().toString(36);
const CONTEXT = 'e2e-migration';
const PROJECT = `e2e-compose-${RUN_ID}`;

const COMPOSE = [
  'services:',
  '  web:',
  '    image: nginx:1.27-alpine',
  '    ports:',
  '      - "8080:80"',
  '  api:',
  '    build: ./api',
  '    image: e2e/api:dev',
  '',
].join('\n');

let userDataDir: string;
let projectDir: string;
let composeFile: string;
let kubeconfig: KubeconfigFile;
let app: ElectronApplication;
let window: Page;

/** Makes the next "Select compose file" answer with `filePath` (or cancel). */
async function answerFilePicker(filePath: string | null): Promise<void> {
  await app.evaluate(({ dialog }, picked) => {
    dialog.showOpenDialog = async () =>
      picked === null
        ? { canceled: true, filePaths: [] }
        : { canceled: false, filePaths: [picked] };
  }, filePath);
}

/** Resolves once the kompose check is over: true when kompose was found. */
async function komposeFound(): Promise<boolean> {
  const select = window.getByRole('button', { name: 'Select compose file' });
  const missing = window.locator('.tool-missing');
  await expect(select.or(missing)).toBeVisible({ timeout: 30_000 });
  return select.isVisible();
}

test.beforeAll(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-e2e-migration-'));
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-e2e-compose-'));
  fs.mkdirSync(path.join(projectDir, 'api'));
  fs.writeFileSync(
    path.join(projectDir, 'api', 'Dockerfile'),
    'FROM alpine:3.20\n'
  );
  composeFile = path.join(projectDir, 'docker-compose.yml');
  fs.writeFileSync(composeFile, COMPOSE);
  // Port 1 refuses at once: the dashboard's calls fail without waiting.
  kubeconfig = writeKubeconfig(
    'migration',
    unreachableKubeconfig(CONTEXT, { server: 'https://127.0.0.1:1' })
  );

  app = await launchApp({ userDataDir, env: { KUBECONFIG: kubeconfig.file } });
  window = await mainWindow(app);
  await window.getByRole('link', { name: 'Migrate' }).click();
  await expect(window.locator('.migration-page__title-text')).toHaveText(
    'Migrate from Docker Compose'
  );
});

test.afterAll(async () => {
  await app?.close();
  for (const dir of [userDataDir, projectDir, kubeconfig?.dir]) {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('without kompose the page says how to get it', async () => {
  test.skip(await komposeFound(), 'kompose is installed on this machine');

  const panel = window.locator('.tool-missing');
  await expect(panel.locator('.tool-missing__title')).toHaveText(
    'kompose not found'
  );
  await expect(
    panel.getByRole('button', { name: 'Check again' })
  ).toBeVisible();
  // Checking again on the same machine keeps the explanation up.
  await panel.getByRole('button', { name: 'Check again' }).click();
  await expect(panel).toBeVisible();
  await expect(
    window.getByRole('button', { name: 'Select compose file' })
  ).toHaveCount(0);
});

test('cancelling the file picker leaves the page as it was', async () => {
  test.skip(!(await komposeFound()), 'kompose is not installed');

  await answerFilePicker(null);
  await window.getByRole('button', { name: 'Select compose file' }).click();
  await expect(
    window.getByRole('button', { name: 'Select compose file' })
  ).toBeEnabled();
  await expect(window.locator('.migration-page__review')).toHaveCount(0);
  await expect(
    window.locator('[data-sonner-toast][data-type="error"]')
  ).toHaveCount(0);
});

test('"Start over" drops a conversion under review', async () => {
  test.skip(!(await komposeFound()), 'kompose is not installed');

  await answerFilePicker(composeFile);
  await window.getByRole('button', { name: 'Select compose file' }).click();
  const review = window.locator('.migration-page__review');
  await expect(review).toBeVisible({ timeout: 60_000 });

  await window.getByRole('button', { name: 'Start over' }).click();
  await expect(review).toHaveCount(0);
  await expect(
    window.getByRole('button', { name: 'Select compose file' })
  ).toBeEnabled();
});

test('converts a compose file and imports the reviewed manifests', async () => {
  test.skip(!(await komposeFound()), 'kompose is not installed');

  await answerFilePicker(composeFile);
  await window.getByRole('button', { name: 'Select compose file' }).click();

  // Review: what kompose made of the two services.
  const review = window.locator('.migration-page__review');
  await expect(review).toBeVisible({ timeout: 60_000 });
  await expect(review.locator('.migration-page__review-source')).toContainText(
    composeFile
  );
  const manifests = review.locator('.migration-page__manifest');
  const kinds = await manifests
    .locator('.migration-page__manifest-kind')
    .allInnerTexts();
  expect(kinds).toContain('Deployment');
  expect(kinds).toContain('Service');
  const total = kinds.length;

  // The api image is built locally: the cluster could not pull it.
  await expect(
    review.locator('.migration-page__warnings--images')
  ).toContainText('e2e/api:dev');
  await expect(review.locator('.migration-page__hint')).toContainText(CONTEXT);

  // Leave the api Deployment out of the import.
  const api = manifests.filter({
    has: window.locator('.migration-page__manifest-name', {
      hasText: /^api-/,
    }),
  });
  await expect(api.first()).toBeVisible();
  const excluded = await api.count();
  for (let i = 0; i < excluded; i++) {
    await api.first().getByTitle('Exclude from import').click();
  }
  const imported = total - excluded;
  await expect(manifests).toHaveCount(imported);

  await window.locator('#migration-project-name').fill(PROJECT);
  await window
    .getByRole('button', { name: `Import ${imported} manifests` })
    .click();

  await expect(window.locator('.migration-page__done-title')).toHaveText(
    'Migration imported'
  );
  await window.getByRole('button', { name: 'Open Manifests' }).click();

  // The library has a folder named after the project with the manifests,
  // labelled with the context they were imported for.
  await expect(
    window.locator('h1', { hasText: 'Manifest Manager' })
  ).toBeVisible();
  await window.locator('.folder-card', { hasText: PROJECT }).click();
  const cards = window.locator('.manifest-card');
  await expect(cards).toHaveCount(imported);
  await expect(cards.filter({ hasText: `Context: ${CONTEXT}` })).toHaveCount(
    imported
  );
  const titles = await cards.locator('h3').allInnerTexts();
  expect(titles.filter((title) => title.startsWith('api-'))).toEqual([]);
  expect(titles).toContain('web-deployment.yaml');
});
