import { test, expect } from '../fixtures/app.fixture';

/**
 * Verifies host theme changes propagate to already-open plugin frames.
 *
 * The sandboxed iframe is opaque-origin, so the test can't read inside it.
 * Instead it asserts the bridge wiring: toggling the host theme flips the host
 * document's data-theme, and the PluginFrame observer dispatches 'host:theme'
 * over the bridge (covered structurally by the unit test). Here we at least
 * confirm the host toggle works while a widget frame is mounted (the regression
 * was that frames only got the theme at load time).
 */
test('host theme toggle updates while a plugin frame is mounted', async ({
  window,
}) => {
  const widgetsSection = window.locator('.dashboard-widgets-section');
  await expect(widgetsSection).toBeVisible({ timeout: 30_000 });
  await expect(widgetsSection.locator('iframe').first()).toBeVisible();

  const themeBefore = await window.evaluate(() =>
    document.documentElement.getAttribute('data-theme')
  );

  // Toggle theme via the sidebar Light/Dark button.
  await window.getByRole('button', { name: /mode/i }).click();

  await expect
    .poll(async () =>
      window.evaluate(() => document.documentElement.getAttribute('data-theme'))
    )
    .not.toBe(themeBefore);

  // Frame is still mounted after the toggle (observer didn't crash it).
  await expect(widgetsSection.locator('iframe').first()).toBeVisible();
});
