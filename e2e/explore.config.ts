import { defineConfig } from '@playwright/test';

/**
 * `npm run test:e2e:interactive`: opens the app and pauses in the Playwright
 * Inspector. The main config ignores explore.spec.ts, so it needs its own.
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'explore.spec.ts',
  timeout: 0,
  workers: 1,
  reporter: [['list']],
});
