import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { launchApp, mainWindow } from '../fixtures/launch';

/**
 * Local terminal: session startup, shell picker, command round-trip through
 * the real spawned shell, Ctrl+C on a running command, and the New Terminal
 * action.
 *
 * No cluster required. The command output assertion reads the xterm DOM
 * renderer rows, so it works without any PTY introspection.
 */

let app: ElectronApplication;
let window: Page;

/** Types a line into the focused terminal and submits it. */
async function run(command: string): Promise<void> {
  await window.locator('.xterm').click();
  await window.keyboard.type(command);
  await window.keyboard.press('Enter');
}

/** Resolves once `marker` shows up in the terminal rows `times` times. */
async function expectMarker(marker: string, times: number): Promise<void> {
  await expect(async () => {
    const text = await window.locator('.xterm-rows').innerText();
    expect(text.split(marker).length - 1).toBeGreaterThanOrEqual(times);
  }).toPass({ timeout: 20_000 });
}

test.beforeAll(async () => {
  app = await launchApp();
  window = await mainWindow(app);

  await window.getByRole('link', { name: 'Terminal' }).click();
  await expect(window.locator('.terminal-page__title-text')).toBeVisible();
});

test.afterAll(async () => {
  await app.close();
});

test('starts a session and shows the active shell badge', async () => {
  await expect(window.locator('.terminal-page__session-badge')).toBeVisible({
    timeout: 30_000,
  });
  await expect(window.locator('.xterm')).toBeVisible();
});

test('shell picker lists the detected shells', async () => {
  const select = window.locator('.terminal-page__shell-select');
  await expect(select).toBeVisible();
  const optionCount = await select.locator('option').count();
  expect(optionCount).toBeGreaterThan(0);
});

test('echo round-trips through the real shell', async () => {
  const marker = `e2e-marker-${Date.now().toString(36)}`;

  // xterm captures keys through a hidden helper textarea. Output (not just
  // the echoed input) appears in the terminal rows: the marker must occur at
  // least twice — once as typed, once as output.
  await run(`echo ${marker}`);
  await expectMarker(marker, 2);
});

test('Ctrl+C stops a running command and the shell keeps working', async () => {
  // A child process that would hold the shell for a minute. Sessions have no
  // PTY, so the interrupt has to reach the child itself (Stop-Process on
  // Windows, pkill -INT on Linux); if it only reached the shell, the echo
  // below would wait for the whole minute and the assertion would time out.
  const longCommand =
    process.platform === 'win32' ? 'ping -n 60 127.0.0.1' : 'sleep 60';
  const marker = `e2e-after-interrupt-${Date.now().toString(36)}`;

  await run(longCommand);
  await window.waitForTimeout(3_000);
  // Lower-case "c": an upper-case letter makes Playwright add Shift, and
  // Ctrl+Shift+C is xterm's copy chord, not an interrupt.
  await window.keyboard.press('Control+c');
  // The terminal echoes ^C itself, so this proves the keystroke reached xterm.
  await expectMarker('^C', 1);

  await run(`echo ${marker}`);
  await expectMarker(marker, 2);
});

test('New Terminal starts a fresh session', async () => {
  const marker = `e2e-old-session-${Date.now().toString(36)}`;
  await window.locator('.xterm').click();
  await window.keyboard.type(`echo ${marker}`);
  await window.keyboard.press('Enter');

  await window.getByRole('button', { name: 'New Terminal' }).click();

  // A new session comes up...
  await expect(window.locator('.terminal-page__session-badge')).toBeVisible({
    timeout: 30_000,
  });
  // ...and its scrollback does not contain the old session's marker.
  await expect(async () => {
    const text = await window.locator('.xterm-rows').innerText();
    expect(text).not.toContain(marker);
  }).toPass({ timeout: 20_000 });
});
