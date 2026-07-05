import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // marketplace-backend has its own vitest suite and is being extracted to
    // a separate repo; the app's test run (and CI) covers the app only.
    exclude: [
      ...configDefaults.exclude,
      '**/dist-electron/**',
      'e2e/**',
      'marketplace-backend/**',
    ],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 80,
      },
      exclude: [
        'styles/**',
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
        '**/dist-electron/**',
        '**/e2e/**',
        'marketplace-backend/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
