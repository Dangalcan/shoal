import { test as base, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'path';

type AppFixtures = {
  app: ElectronApplication;
  window: Page;
};

/**
 * Shared fixture that launches the Electron app and exposes the main window.
 *
 * Prerequisites before running:
 *   npm run build:react && npm run build:electron
 *
 * The app loads dist/index.html (no Vite dev server needed).
 */
export const test = base.extend<AppFixtures>({
  app: async ({}, use) => {
    const app = await electron.launch({
      args: [path.resolve(__dirname, '../..')],
      env: {
        ...process.env,
        ALLOW_UNSIGNED_PLUGINS: 'true',
        NODE_ENV: 'test',
      },
    });
    await use(app);
    await app.close();
  },

  window: async ({ app }, use) => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await use(window);
  },
});

export { expect };
