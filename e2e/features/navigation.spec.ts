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
