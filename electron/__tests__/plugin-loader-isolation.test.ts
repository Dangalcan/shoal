import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PluginLoader } from '../services/plugins/plugin-loader';
import { pluginHostManager } from '../services/plugins/host/plugin-host-manager';
import { LocalPluginModule } from '../services/plugins/host/module-handle';
import fs from 'fs/promises';
import type { Plugin, PluginContext } from '../types/plugin-types';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/user/data'),
    getAppPath: vi.fn().mockReturnValue('/mock/app/path'),
  },
}));

vi.mock('../services/security/signature-service', () => ({
  signatureService: {
    verifyPlugin: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../services/plugins/path-service', () => ({
  pathService: {
    getUserPluginsDir: vi.fn().mockReturnValue('/mock/user/data/plugins'),
    getDiscoveryDirectories: vi
      .fn()
      .mockReturnValue(['/mock/user/data/plugins', '/mock/app/path/plugins']),
    resolvePluginPath: vi.fn(),
  },
}));

vi.mock('../services/plugins/host/plugin-host-manager', () => ({
  pluginHostManager: {
    isSupported: vi.fn().mockReturnValue(true),
    isRunning: vi.fn().mockReturnValue(false),
    spawn: vi.fn(),
    disposePlugin: vi.fn(),
    disposeAll: vi.fn(),
  },
}));

vi.mock('fs/promises', () => {
  const mockFs = {
    readdir: vi.fn(),
    readFile: vi.fn(),
    access: vi.fn(),
    stat: vi.fn(),
  };
  return { ...mockFs, default: mockFs };
});

const makePlugin = (id: string): Plugin =>
  ({
    manifest: {
      id,
      name: id,
      version: '1.0.0',
      description: '',
      author: '',
      main: 'index.js',
      permissions: ['kubernetes'],
      license: { type: 'free' },
    },
    state: 'disabled',
    installedAt: new Date().toISOString(),
  }) as unknown as Plugin;

const fakeContext = { pluginId: 'p1' } as unknown as PluginContext;

describe('PluginLoader isolation', () => {
  let loader: PluginLoader;
  const originalIsolation = process.env.PLUGIN_ISOLATION;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PLUGIN_ISOLATION;
    loader = new PluginLoader();
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(pluginHostManager.isSupported).mockReturnValue(true);
    vi.mocked(pluginHostManager.isRunning).mockReturnValue(false);
  });

  afterEach(() => {
    if (originalIsolation === undefined) delete process.env.PLUGIN_ISOLATION;
    else process.env.PLUGIN_ISOLATION = originalIsolation;
  });

  describe('shouldIsolatePlugin', () => {
    it('isolates user-installed plugins by default', () => {
      expect(
        loader.shouldIsolatePlugin('/mock/user/data/plugins/some-plugin')
      ).toBe(true);
    });

    it('does not isolate bundled plugins by default', () => {
      expect(
        loader.shouldIsolatePlugin('/mock/app/path/plugins/namespace-watcher')
      ).toBe(false);
    });

    it('respects PLUGIN_ISOLATION=off', () => {
      process.env.PLUGIN_ISOLATION = 'off';
      expect(
        loader.shouldIsolatePlugin('/mock/user/data/plugins/some-plugin')
      ).toBe(false);
    });

    it('ignores PLUGIN_ISOLATION=off in packaged builds', async () => {
      const { app } = await import('electron');
      const appMock = app as unknown as { isPackaged?: boolean };
      process.env.PLUGIN_ISOLATION = 'off';
      appMock.isPackaged = true;
      try {
        expect(
          loader.shouldIsolatePlugin('/mock/user/data/plugins/some-plugin')
        ).toBe(true);
      } finally {
        appMock.isPackaged = undefined;
      }
    });

    it('respects PLUGIN_ISOLATION=all', () => {
      process.env.PLUGIN_ISOLATION = 'all';
      expect(
        loader.shouldIsolatePlugin('/mock/app/path/plugins/namespace-watcher')
      ).toBe(true);
    });

    it('falls back to in-process when utility processes are unavailable', () => {
      vi.mocked(pluginHostManager.isSupported).mockReturnValue(false);
      expect(
        loader.shouldIsolatePlugin('/mock/user/data/plugins/some-plugin')
      ).toBe(false);
    });
  });

  describe('acquireModuleHandle', () => {
    it('spawns a utility process for isolated plugins', async () => {
      const plugin = makePlugin('p1');
      loader.registerPlugin(plugin);
      const remoteHandle = {
        isRemote: true,
        has: vi.fn(),
        invoke: vi.fn(),
        dispose: vi.fn(),
      };
      vi.mocked(pluginHostManager.spawn).mockResolvedValue(
        remoteHandle as never
      );

      const handle = await loader.acquireModuleHandle(
        'p1',
        '/mock/user/data/plugins/p1',
        fakeContext
      );

      expect(handle).toBe(remoteHandle);
      expect(pluginHostManager.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: 'p1',
          permissions: ['kubernetes'],
          context: fakeContext,
        })
      );
    });

    it('reuses the running handle on subsequent acquisitions', async () => {
      const plugin = makePlugin('p1');
      loader.registerPlugin(plugin);
      const remoteHandle = {
        isRemote: true,
        has: vi.fn(),
        invoke: vi.fn(),
        dispose: vi.fn(),
      };
      vi.mocked(pluginHostManager.spawn).mockResolvedValue(
        remoteHandle as never
      );
      vi.mocked(pluginHostManager.isRunning).mockReturnValue(true);

      const first = await loader.acquireModuleHandle(
        'p1',
        '/mock/user/data/plugins/p1',
        fakeContext
      );
      const second = await loader.acquireModuleHandle(
        'p1',
        '/mock/user/data/plugins/p1',
        fakeContext
      );

      expect(first).toBe(second);
      expect(pluginHostManager.spawn).toHaveBeenCalledTimes(1);
    });

    it('throws when an isolated plugin is acquired without a context', async () => {
      loader.registerPlugin(makePlugin('p1'));
      await expect(
        loader.acquireModuleHandle('p1', '/mock/user/data/plugins/p1')
      ).rejects.toThrow('requires a context');
    });

    it('returns a local module for bundled plugins', async () => {
      loader.registerPlugin(makePlugin('p1'));
      vi.mocked(fs.readFile).mockResolvedValue(
        'exports.activate = async () => "activated";'
      );

      const handle = await loader.acquireModuleHandle(
        'p1',
        '/mock/app/path/plugins/p1',
        fakeContext
      );

      expect(handle.isRemote).toBe(false);
      expect(handle.has('activate')).toBe(true);
      await expect(handle.invoke('activate')).resolves.toBe('activated');
    });

    it('releaseModuleHandle disposes the remote handle and host process', async () => {
      loader.registerPlugin(makePlugin('p1'));
      const remoteHandle = {
        isRemote: true,
        has: vi.fn(),
        invoke: vi.fn(),
        dispose: vi.fn(),
      };
      vi.mocked(pluginHostManager.spawn).mockResolvedValue(
        remoteHandle as never
      );
      await loader.acquireModuleHandle(
        'p1',
        '/mock/user/data/plugins/p1',
        fakeContext
      );

      loader.releaseModuleHandle('p1');
      expect(remoteHandle.dispose).toHaveBeenCalled();
      expect(pluginHostManager.disposePlugin).toHaveBeenCalledWith('p1');
    });
  });
});

describe('LocalPluginModule', () => {
  it('reports callable exports and ignores non-functions', () => {
    const handle = new LocalPluginModule({ fn: () => 1, value: 42 });
    expect(handle.has('fn')).toBe(true);
    expect(handle.has('value')).toBe(false);
    expect(handle.has('missing')).toBe(false);
    expect(handle.isRemote).toBe(false);
  });

  it('passes the context for withContext invocations', async () => {
    const activate = vi.fn().mockResolvedValue(undefined);
    const handle = new LocalPluginModule({ activate });
    await handle.invoke('activate', { withContext: true }, fakeContext);
    expect(activate).toHaveBeenCalledWith(fakeContext);
  });

  it('passes positional args for action invocations', async () => {
    const action = vi.fn().mockResolvedValue('ok');
    const handle = new LocalPluginModule({ action });
    await expect(handle.invoke('action', { args: [{ a: 1 }] })).resolves.toBe(
      'ok'
    );
    expect(action).toHaveBeenCalledWith({ a: 1 });
  });

  it('rejects invoking a non-function export', async () => {
    const handle = new LocalPluginModule({ value: 42 });
    await expect(handle.invoke('value')).rejects.toThrow('not a function');
    expect(() => handle.dispose()).not.toThrow();
  });
});
