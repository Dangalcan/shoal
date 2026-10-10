import { defineConfig } from '@playwright/test';

/** `npm run screenshots`: captures docs/images, see docs/E2E-TESTS.md. */
export default defineConfig({
  testDir: './screenshots',
  timeout: 600_000,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
});
