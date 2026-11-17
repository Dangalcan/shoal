/**
 * The setup file of this project (`setup.ts`) keeps the real `electron`
 * package out of the test workers. If it stops being loaded, the unit tests
 * go back to running the package's entry point, which downloads the Electron
 * binary when it is missing: this fails first, and every time.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

describe('main-process test setup', () => {
  it('puts an empty module in place of the electron package', () => {
    const nodeRequire = createRequire(__filename);
    const cached = nodeRequire.cache[nodeRequire.resolve('electron')];

    // The cache is checked before anything requires the package: without
    // the stand-in, a require would run the real entry point.
    expect(cached?.loaded).toBe(true);
    expect(cached?.exports).toEqual({});
    expect(nodeRequire('electron')).toBe(cached?.exports);
  });
});
