import { test, expect } from '../fixtures/app.fixture';

/**
 * Smoke test: every sidebar destination renders its page.
 *
 * No cluster required. One app launch, one walk through the sidebar.
 */
test('sidebar navigates to every page', async ({ window }) => {
  // Dashboard is the index route.
  await expect(window.locator('.dashboard-title')).toBeVisible();

  await window.getByRole('link', { name: 'Clusters' }).click();
  await expect(window.locator('.clusters-title')).toBeVisible();

  await window.getByRole('link', { name: 'Manifests' }).click();
  await expect(
    window.locator('h1', { hasText: 'Manifest Manager' })
  ).toBeVisible();

  await window.getByRole('link', { name: 'Terminal' }).click();
  await expect(window.locator('.terminal-page__title-text')).toBeVisible();

  await window.getByRole('link', { name: 'Port Forwards' }).click();
  await expect(window.locator('.port-forwards-page__title-text')).toBeVisible();

  await window.getByRole('link', { name: 'Plugins' }).click();
  await expect(window.locator('.plugins__title')).toBeVisible();

  await window.getByRole('link', { name: 'Settings' }).click();
  await expect(window.locator('.settings-page__title')).toBeVisible();

  // Back to Dashboard.
  await window.getByRole('link', { name: 'Dashboard' }).click();
  await expect(window.locator('.dashboard-title')).toBeVisible();
});

test('the window refuses navigation away and new windows', async ({
  app,
  window,
}) => {
  const before = window.url();

  // A page script trying to leave the app or open a window: the main process
  // denies both (will-navigate, setWindowOpenHandler). A file: URL is used
  // for window.open so that nothing reaches the system browser.
  await window.evaluate(() => {
    globalThis.open('file:///C:/Windows/notepad.exe', '_blank');
    globalThis.location.href = 'https://escape-probe.invalid/';
  });

  // Chromium started the navigation and the main process cancelled it, so
  // Playwright's locators would wait for a navigation that never finishes:
  // ask the page directly, after giving a real navigation time to commit.
  await window.waitForTimeout(2_000);
  const state = await window.evaluate(() => ({
    href: globalThis.location.href,
    dashboard: document.querySelector('.dashboard-title') !== null,
  }));
  expect(state.href).toBe(before);
  expect(state.dashboard).toBe(true);
  expect(window.url()).toBe(before);
  expect(app.windows()).toHaveLength(1);
});

test('theme toggle switches between light and dark', async ({ window }) => {
  const html = window.locator('html');
  const initial = await html.getAttribute('data-theme');

  await window.locator('.theme-toggle').click();
  await expect(html).toHaveAttribute(
    'data-theme',
    initial === 'dark' ? 'light' : 'dark'
  );

  // And back.
  await window.locator('.theme-toggle').click();
  await expect(html).toHaveAttribute('data-theme', initial ?? 'light');
});
