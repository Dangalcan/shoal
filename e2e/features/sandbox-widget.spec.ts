import { test, expect } from '../fixtures/app.fixture';

/**
 * Verifies the two reported sandbox bugs are fixed:
 *  1. Dashboard widget iframe keeps its data (does not thrash/reset on the
 *     dashboard's auto-refresh re-renders).
 *  2. A plugin page scrolls when its content is taller than the frame.
 *
 * Runs against the real Electron app with the bundled plugins.
 */
test('dashboard widget renders inside an iframe and is stable', async ({
  window,
}) => {
  // Dashboard is the index route.
  await window.waitForLoadState('domcontentloaded');

  // The widget section only appears when a widget-contributing plugin is
  // enabled. resource-monitor ships a "Live Pulse" widget.
  const widgetsSection = window.locator('.dashboard-widgets-section');
  await expect(widgetsSection).toBeVisible({ timeout: 30_000 });

  // Widget must render in a sandboxed iframe (not the host realm).
  const widgetFrame = widgetsSection.locator('iframe').first();
  await expect(widgetFrame).toBeVisible();

  // The iframe element must remain the SAME across dashboard re-renders — if the
  // effect deps thrash, React tears the iframe down and remounts it, which is
  // what was killing the in-flight kubectl call (stuck at 0/0).
  const handleA = await widgetFrame.elementHandle();
  await window.waitForTimeout(4000); // allow at least one auto-refresh cycle
  const handleB = await widgetsSection
    .locator('iframe')
    .first()
    .elementHandle();
  expect(await handleA?.evaluate((a, b) => a === b, handleB)).toBe(true);
});

test('plugin page frame is height-bounded so long pages scroll', async ({
  window,
}) => {
  // Navigate to the resource-monitor plugin page (HashRouter).
  await window.evaluate(() => {
    window.location.hash = '#/plugin/resource-monitor';
  });

  const pageFrame = window.locator('.plugin-page-container iframe');
  await expect(pageFrame).toBeVisible({ timeout: 30_000 });

  // With sizing="fill" the frame must fill (not exceed) the viewport, so its own
  // content scrolls internally. If it were content-sized, a tall page would make
  // the iframe taller than the window and the container would clip it (no
  // scrollbar) — the original bug.
  const box = await pageFrame.boundingBox();
  const viewportH = await window.evaluate(() => window.innerHeight);
  expect(box).not.toBeNull();
  expect(box!.height).toBeLessThanOrEqual(viewportH + 2);
  expect(box!.height).toBeGreaterThan(100);
});
