import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { spawnSync } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { launchApp, mainWindow } from '../fixtures/launch';
import { EMPTY_KUBECONFIG, writeKubeconfig } from '../fixtures/kubeconfig';
import type { KubeconfigFile } from '../fixtures/kubeconfig';

/**
 * A workload's life on a real cluster, driven only through the UI: a stored
 * manifest is applied, the Deployment it creates is described, viewed as
 * YAML, saved back to the library, scaled and deleted, and a port-forward to
 * CoreDNS answers real HTTP requests until it is stopped.
 *
 * Prerequisites: kubectl and kind on the PATH and a container runtime for
 * kind (the Linux CI smoke job; not the Windows one). The app runs on a
 * throwaway kubeconfig, so the cluster's context never lands in the
 * kubeconfig of the machine running the spec.
 *
 * Serial: every test builds on the previous one, and after a failure
 * Playwright would start a new worker, run beforeAll again and create a
 * second cluster for tests that can no longer pass.
 */

test.describe.configure({ mode: 'serial' });

const CLUSTER = 'workloads-e2e';
const CONTEXT = `kind-${CLUSTER}`;
const RUN_ID = Date.now().toString(36);
const WORKLOAD = 'e2e-pause';
const APPLIED_MANIFEST = `e2e-workload-${RUN_ID}`;
const BROKEN_MANIFEST = `e2e-broken-${RUN_ID}`;

// pause is a few hundred kilobytes and kind nodes often have it cached.
const DEPLOYMENT_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${WORKLOAD}
  namespace: default
  labels:
    app: ${WORKLOAD}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${WORKLOAD}
  template:
    metadata:
      labels:
        app: ${WORKLOAD}
    spec:
      containers:
        - name: pause
          image: registry.k8s.io/pause:3.10
          imagePullPolicy: IfNotPresent
`;

const BROKEN_YAML = `apiVersion: e2e.invalid/v1
kind: NoSuchKind
metadata:
  name: broken
`;

let userDataDir: string;
let kubeconfig: KubeconfigFile;
let app: ElectronApplication;
let window: Page;

function toast(text: string) {
  return window.locator('[data-sonner-toast]', { hasText: text });
}

async function openTab(name: string): Promise<void> {
  // Anchored: "Pods" is also the start of "PodSecurityAdmission".
  const label = new RegExp(`^\\s*${name}\\s*$`);
  await window.locator('.tab-button', { hasText: label }).click();
  await expect(
    window.locator('.tab-button-active', { hasText: label })
  ).toBeVisible();
}

function row(text: string) {
  return window.locator('.table-row', { hasText: text });
}

async function openClusterDetails(): Promise<void> {
  await window.getByRole('link', { name: 'Clusters' }).click();
  await window
    .locator('.cluster-card', { hasText: CLUSTER })
    .locator('.cluster-card-info')
    .click();
  await expect(window.locator('.cluster-details-container')).toBeVisible();
}

async function createManifest(name: string, content: string): Promise<void> {
  await window.getByRole('button', { name: 'New Manifest' }).click();
  await window.locator('#manifest-name').fill(name);
  await window.locator('#manifest-content').fill(content);
  await window.getByRole('button', { name: 'Save Manifest' }).click();
  await expect(
    window.locator('.manifest-card', { hasText: name })
  ).toBeVisible();
}

/** A local TCP port nothing listens on right now. */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

test.beforeAll(async () => {
  test.setTimeout(300_000);
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-e2e-workloads-'));
  kubeconfig = writeKubeconfig('workloads', EMPTY_KUBECONFIG);
  app = await launchApp({ userDataDir, env: { KUBECONFIG: kubeconfig.file } });
  window = await mainWindow(app);

  await window.getByRole('link', { name: 'Clusters' }).click();
  await window.getByRole('button', { name: 'Create Cluster' }).click();
  await window
    .locator('input.form-input[placeholder="my-cluster"]')
    .fill(CLUSTER);
  await window.locator('.provider-button', { hasText: 'kind' }).click();
  await window.getByRole('button', { name: 'Create Cluster' }).click();
  await expect(
    window.locator('.cluster-card', { hasText: CLUSTER })
  ).toBeVisible({ timeout: 240_000 });
});

test.afterAll(async () => {
  test.setTimeout(180_000);
  try {
    await window.keyboard.press('Escape');
    await window.getByRole('link', { name: 'Clusters' }).click();
    const card = window.locator('.cluster-card', { hasText: CLUSTER });
    await card.locator('.delete-cluster-button').click();
    await window.getByRole('button', { name: 'Delete Cluster' }).last().click();
    await expect(card).not.toBeVisible({ timeout: 60_000 });
  } finally {
    await app?.close();
    // A run that failed before the UI could delete it must not leave the
    // cluster's containers behind (a no-op when it is already gone).
    spawnSync('kind', ['delete', 'cluster', '--name', CLUSTER], {
      env: { ...process.env, KUBECONFIG: kubeconfig.file },
      stdio: 'ignore',
    });
    fs.rmSync(userDataDir, { recursive: true, force: true });
    fs.rmSync(kubeconfig.dir, { recursive: true, force: true });
  }
});

test('the new cluster becomes the current context', async () => {
  await expect(window.locator('.context-switcher__current')).toHaveText(
    CONTEXT
  );
});

test('Port Forwards starts empty', async () => {
  await window.getByRole('link', { name: 'Port Forwards' }).click();
  await expect(window.locator('.port-forwards-page__empty-title')).toHaveText(
    'No active port forwards'
  );
});

test('a manifest kubectl rejects reports the error', async () => {
  await window.getByRole('link', { name: 'Manifests' }).click();
  await createManifest(BROKEN_MANIFEST, BROKEN_YAML);
  const card = window.locator('.manifest-card', { hasText: BROKEN_MANIFEST });
  await expect(card).toContainText(`Context: ${CONTEXT}`);

  await card.hover();
  await card.locator('button[title="Apply to Cluster"]').click();
  await expect(
    window.locator('[data-sonner-toast][data-type="error"]', {
      hasText: 'Error applying manifest',
    })
  ).toBeVisible({ timeout: 30_000 });
});

test('a stored manifest is applied to the cluster', async () => {
  await createManifest(APPLIED_MANIFEST, DEPLOYMENT_YAML);
  const card = window.locator('.manifest-card', { hasText: APPLIED_MANIFEST });
  await expect(card).toContainText(`Context: ${CONTEXT}`);

  await card.hover();
  await card.locator('button[title="Apply to Cluster"]').click();
  await expect(toast('Manifest applied successfully!')).toBeVisible({
    timeout: 30_000,
  });

  await openClusterDetails();
  await openTab('Deployments');
  await expect(row(WORKLOAD)).toBeVisible({ timeout: 30_000 });
  await openTab('Pods');
  await expect(row(WORKLOAD).filter({ hasText: 'Running' })).toHaveCount(1, {
    timeout: 90_000,
  });
});

test('describe and YAML show the live Deployment', async () => {
  test.setTimeout(60_000);
  await openTab('Deployments');
  const deployment = row(WORKLOAD);

  await deployment.hover();
  await deployment.locator('.action-button-describe').click();
  const describe = window.getByTestId('describe-modal');
  await expect(describe).toContainText(`Name:`);
  await expect(describe).toContainText(WORKLOAD);
  await expect(describe).toContainText('Replicas:');
  await describe.locator('.close-footer-button').click();
  await expect(describe).not.toBeVisible();

  await deployment.hover();
  await deployment.locator('.action-button-yaml').click();
  const yaml = window.getByTestId('yaml-modal');
  await expect(yaml).toContainText('kind: Deployment');
  await expect(yaml).toContainText(`name: ${WORKLOAD}`);
  await expect(yaml).toContainText(`Context: ${CONTEXT}`);

  // The live object can go back into the library.
  await yaml.getByRole('button', { name: 'Save to DB' }).click();
  await expect(toast(`Manifest "${WORKLOAD}" saved to database`)).toBeVisible();
  await yaml.locator('.close-footer-button').click();
  await expect(yaml).not.toBeVisible();
});

test('scaling the Deployment to 2 replicas starts a second pod', async () => {
  await openTab('Deployments');
  const deployment = row(WORKLOAD);
  await deployment.hover();
  await deployment.locator('.action-button-scale').click();

  const modal = window.locator('.base-modal-overlay');
  await expect(modal.locator('.scale-modal__current')).toContainText(
    'Current replicas: 1'
  );
  const scale = modal.getByRole('button', { name: 'Scale to 1' });
  // Scaling to the current count is not an action.
  await expect(scale).toBeDisabled();
  await modal.getByLabel('Replica count', { exact: true }).fill('2');
  await modal.getByRole('button', { name: 'Scale to 2' }).click();
  await expect(modal).not.toBeVisible();

  await openTab('Pods');
  await expect(row(WORKLOAD).filter({ hasText: 'Running' })).toHaveCount(2, {
    timeout: 90_000,
  });
});

test('a port-forward to CoreDNS serves its metrics until it is stopped', async () => {
  test.setTimeout(90_000);
  const port = await freePort();

  await openTab('Services');
  const service = row('kube-dns');
  await expect(service).toBeVisible({ timeout: 15_000 });
  await service.hover();
  await service.locator('.action-button-forward').click();

  const modal = window.locator('.base-modal-overlay');
  await expect(modal.locator('.base-modal-title')).toHaveText(
    'Forward service/kube-dns'
  );
  // kube-dns declares 53 (DNS) and 9153 (metrics): pick metrics.
  await modal.getByRole('button', { name: '9153', exact: true }).click();
  const local = modal.locator('.port-forward-modal__input').nth(1);
  await expect(local).toHaveValue('9153');
  await local.fill(String(port));
  await modal.getByRole('button', { name: 'Start Forward' }).click();
  await expect(modal).not.toBeVisible({ timeout: 30_000 });

  // A real HTTP request through the tunnel.
  const url = `http://127.0.0.1:${port}/metrics`;
  await expect
    .poll(
      async () => {
        try {
          const response = await fetch(url);
          return response.ok && (await response.text()).includes('coredns_');
        } catch {
          return false;
        }
      },
      { timeout: 30_000 }
    )
    .toBe(true);

  await window.getByRole('link', { name: 'Port Forwards' }).click();
  const forward = window.locator('.port-forwards-page__row', {
    hasText: 'service/kube-dns',
  });
  await expect(forward).toContainText('kube-system');
  await expect(forward).toContainText(CONTEXT);
  await expect(forward).toContainText(`localhost:${port} → 9153`);

  await forward.getByRole('button', { name: 'Stop' }).click();
  await expect(window.locator('.port-forwards-page__empty-title')).toHaveText(
    'No active port forwards'
  );
  await expect
    .poll(
      async () => {
        try {
          await fetch(url);
          return 'open';
        } catch {
          return 'closed';
        }
      },
      { timeout: 15_000 }
    )
    .toBe('closed');
});

test('the PodSecurityAdmission tab shows the levels set on each namespace', async () => {
  // Pod Security Admission is configured through namespace labels; the tab
  // reads namespaces (there is no podsecurityadmission resource to list).
  const label = spawnSync(
    'kubectl',
    [
      'label',
      'namespace',
      'default',
      '--context',
      CONTEXT,
      '--overwrite',
      'pod-security.kubernetes.io/enforce=baseline',
      'pod-security.kubernetes.io/warn=restricted',
      'pod-security.kubernetes.io/warn-version=v1.30',
    ],
    { env: { ...process.env, KUBECONFIG: kubeconfig.file }, encoding: 'utf-8' }
  );
  expect(label.status, label.stderr).toBe(0);

  await openClusterDetails();
  await window.locator('button[title="Display Settings"]').click();
  // Its category (Advanced) starts collapsed; filtering shows the item.
  await window.locator('.settings-search-input').fill('PodSecurity');
  await window
    .locator('.settings-dropdown .settings-item-button')
    .filter({ hasText: /^PodSecurityAdmission$/ })
    .click();
  await window.locator('button[title="Close Settings"]').click();
  await openTab('PodSecurityAdmission');

  const namespace = window.locator('.table-row').filter({
    has: window.locator('.pod-name-text', { hasText: /^default$/ }),
  });
  await expect(namespace).toContainText('baseline', { timeout: 30_000 });
  await expect(namespace).toContainText('restricted (v1.30)');

  // Each row is a namespace: it can be described, never deleted from here.
  await namespace.hover();
  await expect(namespace.locator('.action-button-delete')).toHaveCount(0);
  await namespace.locator('.action-button-describe').click();
  const describe = window.getByTestId('describe-modal');
  await expect(describe).toContainText(
    'pod-security.kubernetes.io/enforce=baseline'
  );
  await describe.locator('.close-footer-button').click();
  await expect(describe).not.toBeVisible();
});

test('deleting the Deployment removes it from the cluster', async () => {
  test.setTimeout(90_000);
  await openClusterDetails();
  await openTab('Deployments');
  const deployment = row(WORKLOAD);
  await deployment.hover();
  await deployment.locator('.action-button-delete').click();

  const confirm = window.locator('.confirm-modal-body');
  await expect(confirm).toContainText(`deployments/${WORKLOAD}`);
  await window
    .getByRole('button', { name: 'Delete deployments' })
    .last()
    .click();
  await expect(deployment).toHaveCount(0, { timeout: 30_000 });

  await openTab('Pods');
  await expect(row(WORKLOAD)).toHaveCount(0, { timeout: 60_000 });
});

test('the saved YAML is in the library under the cluster context', async () => {
  await window.getByRole('link', { name: 'Manifests' }).click();
  const saved = window.locator('.manifest-card').filter({
    has: window.locator('h3', { hasText: new RegExp(`^${WORKLOAD}$`) }),
  });
  await expect(saved).toHaveCount(1);
  await expect(saved).toContainText(`Context: ${CONTEXT}`);
  await expect(saved.locator('.yaml-preview')).toContainText(
    'kind: Deployment'
  );
});
