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
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Every production file counts, not only the ones a test happens to
      // import; the process entry points are exercised by the e2e suite.
      include: ['electron/**/*.ts', 'src/**/*.{ts,tsx}'],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 80,
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
