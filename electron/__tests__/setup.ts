/**
 * Setup file of the `electron` Vitest project (the main-process unit tests).
 *
 * These tests run on plain Node, where `electron` resolves to the npm
 * package. Its entry point is not the Electron API: it locates the Electron
 * binary and, since Electron 42, downloads it first when it is missing.
 *
 * `vi.mock('electron', ...)` only replaces the module for the code Vitest
 * transforms. A plain `require('electron')` goes around it (electron-log's
 * main entry, which `logger.ts` imports, and `PluginHostManager`), and so
 * does the import in a test file that declares no mock. On a fresh install
 * each of those ran the real entry, and the Vitest workers that downloaded
 * the binary at the same time broke one another's extraction.
 *
 * The stand-in below takes the package's place in Node's module cache, which
 * `require()` and `import` share, so the real entry never runs in a test
 * worker. It exports nothing, as there is no Electron API outside Electron:
 * a test that needs part of it declares it with `vi.mock('electron', ...)`.
 */
import { createRequire } from 'module';

const nodeRequire = createRequire(__filename);
const electronEntry = nodeRequire.resolve('electron');

if (!nodeRequire.cache[electronEntry]) {
  nodeRequire.cache[electronEntry] = {
    id: electronEntry,
    filename: electronEntry,
    loaded: true,
    exports: {},
  } as NodeJS.Module;
}
