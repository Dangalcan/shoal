import { test, expect } from './fixtures/app.fixture';

/**
 * Interactive exploration test.
 *
 * Run with:
 *   npm run test:e2e:interactive
 *
 * This opens the real Electron app and PAUSES — you can then:
 *   - Click anywhere in the app window
 *   - Use the Playwright Inspector (opens automatically) to pick locators
 *   - See the generated selector for any element you hover over
 *   - Press Resume in the Inspector when you're done exploring
 */
test('explore the app interactively', async ({ window }) => {
  // Waits for the app to finish loading
  await expect(window).toHaveTitle(/Kubernetes Desktop/i);

  // ↓ This opens Playwright Inspector and freezes here.
  //   Click around in the app. The Inspector shows you the locator
  //   for whatever you hover over — copy those into real tests.
  await window.pause();
});
