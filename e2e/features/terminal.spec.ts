import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { launchApp, mainWindow } from '../fixtures/launch';

/**
 * Local terminal: session startup, shell picker, command round-trip through
 * the real spawned shell, and the New Terminal action.
 *
 * No cluster required. The command output assertion reads the xterm DOM
 * renderer rows, so it works without any PTY introspection.
 */

let app: ElectronApplication;
let window: Page;

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

  // xterm captures keys through a hidden helper textarea.
  await window.locator('.xterm').click();
  await window.keyboard.type(`echo ${marker}`);
  await window.keyboard.press('Enter');

  // Output (not just the echoed input) appears in the terminal rows: the
  // marker must occur at least twice — once as typed, once as output.
  await expect(async () => {
    const text = await window.locator('.xterm-rows').innerText();
    const occurrences = text.split(marker).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 20_000 });
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
