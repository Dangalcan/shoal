import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: [
      ...configDefaults.exclude,
      '**/dist-electron/**',
      'e2e/**',
      // Nested checkouts and tool scratch directories live in dot-directories
      // inside the project; without this a test run picks up their copies.
      '**/.*/**',
    ],
    globals: true,
    // One project per process. The main-process tests need only Node, so
    // they skip the jsdom boot (the largest cost of a run) and the renderer
    // setup file; the renderer tests keep jsdom and the shared setup. Both
    // inherit everything else from this config (`extends: true`); coverage
    // is read from the root only and spans both projects.
    projects: [
      {
        extends: true,
        test: {
          name: 'electron',
          include: ['electron/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'src',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Every production file counts, not only the ones a test happens to
      // import; the process entry points are exercised by the e2e suite.
      include: ['electron/**/*.ts', 'src/**/*.{ts,tsx}'],
      // A ratchet a few points under what the suite reaches (all four at
      // 99-100% in November 2026): room for a change, not for a regression.
      thresholds: {
        lines: 97,
        statements: 97,
        functions: 97,
        branches: 95,
      },
      exclude: [
        // Glob patterns: Vitest 5 no longer treats a bare directory
        // ('src/test/') as a prefix.
        'styles/**',
        'node_modules/**',
        'src/test/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
        '**/dist-electron/**',
        '**/e2e/**',
        '**/.*/**',
        'electron/__tests__/**',
        'electron/main.ts',
        'electron/preload.ts',
        'src/main.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
