import { defineConfig } from '@playwright/test';

/** `npm run screenshots`: captures docs/images, see docs/E2E-TESTS.md. */
export default defineConfig({
  testDir: './screenshots',
  // The README demo recording has its own config (e2e/demo.config.ts).
  testIgnore: 'demo.spec.ts',
  timeout: 600_000,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
});
