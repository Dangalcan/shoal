import { test as base, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { launchApp, mainWindow } from './launch';

type AppFixtures = {
  app: ElectronApplication;
  window: Page;
};

/**
 * Shared fixture that launches the Electron app (see launch.ts: dev build or
 * the packaged executable in SHOAL_E2E_EXECUTABLE) and exposes the main window.
 *
 * Prerequisites for the dev build:
 *   npm run build:react && npm run build:electron
 *
 * The app loads dist/index.html (no Vite dev server needed).
 */
export const test = base.extend<AppFixtures>({
  app: async ({}, use) => {
    const app = await launchApp();
    await use(app);
    await app.close();
  },

  window: async ({ app }, use) => {
    const window = await mainWindow(app);
    await use(window);
  },
});

export { expect };
