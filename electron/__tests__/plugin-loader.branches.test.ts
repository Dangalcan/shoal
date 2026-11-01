/**
 * PluginLoader branches the other suites leave out: a plugin directory that
 * cannot be loaded during discovery, manifests without `main` or
 * `permissions`, an isolated plugin that was never registered, and failures
 * that must not escape unloadPluginCode or shouldIsolatePlugin.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import type { Dirent } from 'fs';
import type { Plugin, PluginContext } from '../types/plugin-types';

const mocks = vi.hoisted(() => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  pathService: {
    getUserPluginsDir: vi.fn(),
    getBundledPluginsDir: vi.fn(),
    getDiscoveryDirectories: vi.fn(),
    resolvePluginPath: vi.fn(),
  },
  hostManager: {
    isSupported: vi.fn(),
    isRunning: vi.fn(),
    spawn: vi.fn(),
    disposePlugin: vi.fn(),
  },
  fs: { readdir: vi.fn(), readFile: vi.fn(), access: vi.fn() },
}));

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: vi.fn(), getAppPath: vi.fn() },
}));
vi.mock('../logger', () => ({ default: mocks.log }));
vi.mock('../services/plugins/path-service', () => ({
  pathService: mocks.pathService,
}));
vi.mock('../services/plugins/host/plugin-host-manager', () => ({
  pluginHostManager: mocks.hostManager,
}));
vi.mock('../services/security/signature-service', () => ({
  signatureService: { checkPlugin: vi.fn().mockResolvedValue({ ok: true }) },
  describeSignatureProblem: (problem: string) => problem,
}));
vi.mock('fs/promises', () => ({ ...mocks.fs, default: mocks.fs }));

import { PluginLoader } from '../services/plugins/plugin-loader';

const BUNDLED = path.resolve('/mock/app/plugins');
const USER = path.resolve('/mock/user/plugins');

const dir = (name: string): Dirent =>
  ({ name, isDirectory: () => true }) as unknown as Dirent;

const manifestJson = (id: string): string =>
  JSON.stringify({
    id,
    name: id,
    version: '1.0.0',
    description: 'd',
    author: 'a',
    main: 'index.js',
    permissions: [],
    license: { type: 'free' },
  });

/** A registered plugin whose manifest leaves out `main` and `permissions`. */
const bareManifestPlugin = (id: string): Plugin =>
  ({
    manifest: {
      id,
      name: id,
      version: '1.0.0',
      description: '',
      author: '',
      license: { type: 'free' },
    },
    state: 'disabled',
    installedAt: '2026-01-01T00:00:00.000Z',
  }) as Plugin;

const context = { pluginId: 'p1' } as unknown as PluginContext;

describe('PluginLoader branches', () => {
  let loader: PluginLoader;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PLUGIN_ISOLATION', '');
    mocks.pathService.getDiscoveryDirectories.mockReturnValue([BUNDLED, USER]);
    mocks.pathService.getBundledPluginsDir.mockReturnValue(BUNDLED);
    mocks.pathService.getUserPluginsDir.mockReturnValue(USER);
    mocks.hostManager.isSupported.mockReturnValue(true);
    mocks.hostManager.isRunning.mockReturnValue(false);
    mocks.fs.access.mockResolvedValue(undefined);
    loader = new PluginLoader();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('skips a plugin directory that cannot be loaded during discovery', async () => {
    mocks.fs.readdir.mockImplementation(async (directory: string) =>
      directory === BUNDLED ? [dir('broken'), dir('good')] : []
    );
    mocks.fs.readFile.mockImplementation(async (file: string) => {
      if (file === path.join(BUNDLED, 'good', 'plugin.json')) {
        return manifestJson('good');
      }
      return '{ not json';
    });

    const plugins = await loader.discoverPlugins();

    expect(plugins.map((p) => p.manifest.id)).toEqual(['good']);
    expect(mocks.log.error).toHaveBeenCalledWith(
      `[PluginLoader] Failed to load plugin from ${path.join(BUNDLED, 'broken')}:`,
      expect.any(String)
    );
  });

  it('runs index.js when the manifest names no main entry', async () => {
    loader.registerPlugin(bareManifestPlugin('p1'));
    const pluginPath = path.join(BUNDLED, 'p1');
    mocks.fs.readFile.mockResolvedValue('exports.ping = () => "pong";');

    const exports = await loader.loadPluginCode('p1', pluginPath);

    expect(mocks.fs.access).toHaveBeenCalledWith(
      path.join(pluginPath, 'index.js')
    );
    expect(mocks.fs.readFile).toHaveBeenCalledWith(
      path.join(pluginPath, 'index.js'),
      'utf8'
    );
    expect((exports.ping as () => string)()).toBe('pong');
  });

  it('never rejects from unloadPluginCode, even when logging fails', async () => {
    mocks.log.info.mockImplementationOnce(() => {
      throw new Error('log file locked');
    });

    await expect(
      loader.unloadPluginCode('p1', path.join(BUNDLED, 'p1'))
    ).resolves.toBeUndefined();
    expect(mocks.log.error).toHaveBeenCalledWith(
      '[PluginLoader] Failed to unload plugin code for p1:',
      'log file locked'
    );
  });

  it('runs a plugin in-process when the user plugins directory is unknown', () => {
    mocks.pathService.getUserPluginsDir.mockImplementation(() => {
      throw new Error('userData unavailable');
    });

    expect(loader.shouldIsolatePlugin(path.join(USER, 'p1'))).toBe(false);
  });

  describe('isolated plugins', () => {
    it('refuses to spawn a plugin that was never registered', async () => {
      await expect(
        loader.acquireModuleHandle('ghost', path.join(USER, 'ghost'), context)
      ).rejects.toThrow('Plugin ghost not found');
      expect(mocks.hostManager.spawn).not.toHaveBeenCalled();
    });

    it('spawns index.js with no permissions when the manifest names neither', async () => {
      loader.registerPlugin(bareManifestPlugin('p1'));
      const handle = { isRemote: true, has: vi.fn(), invoke: vi.fn() };
      mocks.hostManager.spawn.mockResolvedValue(handle);
      const pluginPath = path.join(USER, 'p1');

      await expect(
        loader.acquireModuleHandle('p1', pluginPath, context)
      ).resolves.toBe(handle);

      expect(mocks.hostManager.spawn).toHaveBeenCalledWith({
        pluginId: 'p1',
        pluginPath,
        mainFile: path.join(pluginPath, 'index.js'),
        permissions: [],
        context,
      });
    });
  });
});
