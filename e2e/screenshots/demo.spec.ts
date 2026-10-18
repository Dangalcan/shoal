import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { launchApp, mainWindow } from '../fixtures/launch';

/**
 * Records the README demo (`npm run demo-gif`): a short tour of the app,
 * captured as screenshots only during the moments worth keeping, which
 * scripts/demo-gif.js joins into docs/images/demo.gif. Playwright cannot
 * record a video of an Electron window, so the frames are taken with
 * page.screenshot while the tour runs, with their real timestamps.
 *
 * Same prerequisites as capture.spec.ts (a packaged build in
 * SHOAL_E2E_EXECUTABLE, the kind cluster `shoal-demo` with the demo
 * workload, a KUBECONFIG that holds only that cluster) plus a running
 * Docker: the tour creates a second kind cluster, `demo`, which is deleted
 * afterwards. Setup in docs/E2E-TESTS.md.
 */

const OUT_DIR = path.resolve(__dirname, '../../test-results/demo');
const FRAMES_DIR = path.join(OUT_DIR, 'frames');
const WIDTH = 1280;
const HEIGHT = 800;
const CONTEXT = 'kind-shoal-demo';
const NEW_CLUSTER = 'demo';
/** Milliseconds between typed characters, so typing reads as typing. */
const TYPING_DELAY = 70;
/** How long the last frame of a take stays on screen, in seconds. */
const HOLD = 0.4;

let app: ElectronApplication;
let window: Page;

/**
 * Takes screenshots back to back while a take runs (about 8 to 12 per
 * second on an Electron window) and lists them for ffmpeg's concat demuxer
 * with the time each one stayed on screen.
 */
class FrameRecorder {
  private frames: Array<{ file: string; at: number }> = [];
  private running = false;
  private loop: Promise<void> = Promise.resolve();

  constructor(private readonly page: Page) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loop = (async () => {
      while (this.running) {
        const at = Date.now();
        const file = path.join(
          FRAMES_DIR,
          `frame-${String(this.frames.length).padStart(5, '0')}.png`
        );
        try {
          await this.page.screenshot({
            path: file,
            clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
            animations: 'allow',
          });
          this.frames.push({ file, at });
        } catch {
          // A screenshot can fail while the window is busy; skip the frame.
        }
      }
    })();
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.loop;
    this.frames.push({ file: '', at: Date.now() }); // marks the take's end
  }

  /** Writes the concat list; consecutive takes join without a gap. */
  write(listPath: string): number {
    const lines: string[] = [];
    let count = 0;
    for (let i = 0; i < this.frames.length; i++) {
      const frame = this.frames[i];
      if (frame.file === '') continue;
      const next = this.frames[i + 1];
      const seconds =
        next && next.at > frame.at ? (next.at - frame.at) / 1000 : HOLD;
      lines.push(`file '${frame.file.replace(/\\/g, '/')}'`);
      lines.push(`duration ${Math.min(seconds, 1).toFixed(3)}`);
      count++;
    }
    // The concat demuxer wants the last file repeated after its duration.
    const last = [...this.frames].reverse().find((f) => f.file !== '');
    if (last) lines.push(`file '${last.file.replace(/\\/g, '/')}'`);
    fs.writeFileSync(listPath, lines.join('\n') + '\n');
    return count;
  }
}

let recorder: FrameRecorder;

async function settled() {
  await expect(window.locator('[data-sonner-toast]')).toHaveCount(0, {
    timeout: 15_000,
  });
}

test.beforeAll(async () => {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  // The terminal opens in the home directory and its prompt shows the path,
  // so the app gets a neutral home: no user name in the recording. kubectl
  // and kind keep working because KUBECONFIG is set explicitly.
  const home =
    process.platform === 'win32' ? 'C:\\Users\\Public' : '/tmp/shoal-demo';
  fs.mkdirSync(home, { recursive: true });
  app = await launchApp({ env: { HOME: home, USERPROFILE: home } });
  window = await mainWindow(app);
  recorder = new FrameRecorder(window);
  await app.evaluate(
    ({ BrowserWindow }, size) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.setContentSize(size.width, size.height);
      win.center();
    },
    { width: WIDTH, height: HEIGHT }
  );
  const html = window.locator('html');
  if ((await html.getAttribute('data-theme')) !== 'light') {
    await window.locator('.theme-toggle').click();
  }
  await expect(html).toHaveAttribute('data-theme', 'light');
});

test.afterAll(async () => {
  await recorder?.stop();
  const count = recorder?.write(path.join(OUT_DIR, 'frames.txt')) ?? 0;
  console.log(`${count} frames written to ${FRAMES_DIR}`);
  await app?.close();
  // The tour's cluster is not needed afterwards; the demo one stays for
  // the screenshots.
  await promisify(execFile)('kind', [
    'delete',
    'cluster',
    '--name',
    NEW_CLUSTER,
  ]).catch(() => undefined);
});

test('records the README tour', async () => {
  // 1. Dashboard with the demo cluster active.
  await window.getByRole('link', { name: 'Dashboard' }).click();
  await expect(window.locator('.dashboard-title')).toBeVisible();
  await expect(window.getByText(CONTEXT).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(window.getByText('Checking...')).toHaveCount(0, {
    timeout: 30_000,
  });
  await settled();
  recorder.start();
  await window.waitForTimeout(1_500);

  // 2. Create a kind cluster; the wait for kind is not recorded.
  await window.getByRole('link', { name: 'Clusters' }).click();
  await expect(window.locator('.clusters-title')).toBeVisible();
  await window.waitForTimeout(700);
  await window.getByRole('button', { name: 'Create Cluster' }).click();
  await expect(window.locator('.create-cluster-form')).toBeVisible();
  await window.locator('.provider-button', { hasText: 'kind' }).click();
  const name = window.locator('input.form-input[placeholder="my-cluster"]');
  await name.click();
  await name.pressSequentially(NEW_CLUSTER, { delay: TYPING_DELAY });
  await window.waitForTimeout(500);
  await window.getByRole('button', { name: 'Create Cluster' }).click();
  await window.waitForTimeout(900);
  await recorder.stop();

  const newCard = window.locator('.cluster-card', {
    has: window.locator('.cluster-card-name', {
      hasText: new RegExp(`^kind-${NEW_CLUSTER}$`),
    }),
  });
  await expect(newCard).toBeVisible({ timeout: 300_000 });
  await settled();
  recorder.start();
  await window.waitForTimeout(1_500);

  // 3. Pods of the demo cluster and the logs of one of them.
  await window
    .locator('.cluster-card', { hasText: CONTEXT })
    .locator('.cluster-card-info')
    .click();
  await expect(window.locator('.cluster-details-container')).toBeVisible();
  await window.locator('#namespace-selector').selectOption('demo');
  await window.locator('.tab-button', { hasText: 'Pods' }).click();
  const row = window
    .locator('.table-row', { hasText: 'web-' })
    .filter({ hasText: 'Running' })
    .first();
  await expect(row).toBeVisible({ timeout: 60_000 });
  await window.waitForTimeout(600);
  await row.hover();
  await window.waitForTimeout(400);
  await row.locator('.action-button-logs').click();
  const modal = window.getByTestId('log-modal');
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId('log-content')).not.toBeEmpty({
    timeout: 30_000,
  });
  await window.waitForTimeout(1_800);
  await window.keyboard.press('Escape');
  await expect(modal).toBeHidden();

  // 4. A manifest from the examples, applied in one click.
  await window.getByRole('link', { name: 'Manifests' }).click();
  await window.waitForTimeout(600);
  await window.getByRole('button', { name: 'Examples' }).click();
  await expect(
    window.locator('.base-modal-title', { hasText: 'Example Manifests' })
  ).toBeVisible();
  await window.waitForTimeout(600);
  await window
    .locator('.example-templates__item', { hasText: 'Deployment' })
    .first()
    .click();
  await expect(window.locator('#manifest-content')).not.toHaveValue('');
  await window.waitForTimeout(700);
  await window.getByRole('button', { name: 'Save Manifest' }).click();
  const card = window.locator('.manifest-card').first();
  await expect(card).toBeVisible();
  await window.waitForTimeout(500);
  await card.getByTitle('Apply to Cluster').click();
  await expect(window.getByText('Manifest applied successfully!')).toBeVisible({
    timeout: 60_000,
  });
  await window.waitForTimeout(1_200);
  await recorder.stop();
  await settled();

  // 5. kubectl in the built-in terminal.
  await window.getByRole('link', { name: 'Terminal' }).click();
  await expect(window.locator('.terminal-page__session-badge')).toBeVisible({
    timeout: 30_000,
  });
  // Windows shells print a prompt through the pipe; unix shells do not, so
  // the app writes a "Shell ready" line instead. Type only once it is there.
  await expect(window.locator('.xterm-rows')).toContainText(
    process.platform === 'win32' ? 'PS ' : 'Shell ready',
    { timeout: 30_000 }
  );
  await window.locator('.xterm').click();
  await window.waitForTimeout(800);
  recorder.start();
  await window.keyboard.type('kubectl get pods -A', { delay: TYPING_DELAY });
  await window.keyboard.press('Enter');
  await expect(window.locator('.xterm-rows')).toContainText('kube-system', {
    timeout: 30_000,
  });
  await window.waitForTimeout(1_500);
  await recorder.stop();
});
