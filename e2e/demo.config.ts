import { defineConfig } from '@playwright/test';

/** `npm run demo-gif`: records the README demo, see docs/E2E-TESTS.md. */
export default defineConfig({
  testDir: './screenshots',
  testMatch: 'demo.spec.ts',
  outputDir: '../test-results/demo',
  timeout: 900_000,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
});
