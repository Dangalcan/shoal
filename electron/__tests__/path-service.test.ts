import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PathService } from '../services/plugins/path-service';
import { app } from 'electron';
import path from 'path';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(),
    getAppPath: vi.fn().mockReturnValue('/mock/app/path'),
  },
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    access: vi.fn(),
  },
}));

import fs from 'fs/promises';

describe('PathService', () => {
  let pathService: PathService;

  beforeEach(() => {
    vi.clearAllMocks();
    pathService = new PathService();
    vi.mocked(app.getPath).mockReturnValue('/mock/user/data');
  });

  it('should return correct user plugins directory', () => {
    const dir = pathService.getUserPluginsDir();
    expect(dir).toBe(path.join('/mock/user/data', 'plugins'));
  });

  it('should return correct bundled plugins directory', () => {
    const dir = pathService.getBundledPluginsDir();
    expect(dir).toBe(path.join('/mock/app/path', 'plugins'));
  });

  it('should read bundled plugins from resourcesPath when packaged', () => {
    const appMock = app as unknown as { isPackaged?: boolean };
    const originalResourcesPath = process.resourcesPath;
    appMock.isPackaged = true;
    Object.defineProperty(process, 'resourcesPath', {
      value: '/mock/resources',
      configurable: true,
    });
    try {
      expect(pathService.getBundledPluginsDir()).toBe(
        path.join('/mock/resources', 'plugins')
      );
    } finally {
      appMock.isPackaged = undefined;
      Object.defineProperty(process, 'resourcesPath', {
        value: originalResourcesPath,
        configurable: true,
      });
    }
  });

  it('should return discovery directories, bundled first', () => {
    const dirs = pathService.getDiscoveryDirectories();
    expect(dirs).toEqual([
      path.join('/mock/app/path', 'plugins'),
      path.join('/mock/user/data', 'plugins'),
    ]);
  });

  it('should tell whether a plugin id is bundled', async () => {
    vi.mocked(fs.access).mockImplementation(async (p: any) => {
      if (p.toString() === path.join('/mock/app/path', 'plugins', 'bundled'))
        return undefined;
      throw new Error('No access');
    });

    expect(await pathService.isBundledPluginId('bundled')).toBe(true);
    expect(await pathService.isBundledPluginId('mine')).toBe(false);
  });

  it('should return plugin storage directory', () => {
    const dir = pathService.getPluginStorageDir('test-p');
    expect(dir).toBe(path.join('/mock/user/data', 'plugin-storage', 'test-p'));
  });

  it('should return plugin database path', () => {
    const dbPath = pathService.getPluginDatabasePath('test-p');
    expect(dbPath).toBe(
      path.join('/mock/user/data', 'plugin-storage', 'test-p', 'storage.db')
    );
  });

  it('should return plugin log directory', () => {
    const dir = pathService.getPluginLogDir('test-p');
    expect(dir).toBe(path.join('/mock/user/data', 'logs', 'plugins', 'test-p'));
  });

  it('should return plugin cache directory', () => {
    const dir = pathService.getPluginCacheDir('test-p');
    expect(dir).toBe(
      path.join('/mock/user/data', 'cache', 'plugins', 'test-p')
    );
  });

  describe('ensureDir', () => {
    it('should create directory recursively', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      await pathService.ensureDir('/some/path');
      expect(fs.mkdir).toHaveBeenCalledWith('/some/path', { recursive: true });
    });

    it('should ignore EEXIST error', async () => {
      const error = new Error('EEXIST');
      (error as any).code = 'EEXIST';
      vi.mocked(fs.mkdir).mockRejectedValue(error);

      await expect(
        pathService.ensureDir('/some/path')
      ).resolves.toBeUndefined();
    });

    it('should throw other errors', async () => {
      const error = new Error('ENOENT');
      (error as any).code = 'ENOENT';
      vi.mocked(fs.mkdir).mockRejectedValue(error);

      await expect(pathService.ensureDir('/some/path')).rejects.toThrow(
        'ENOENT'
      );
    });
  });

  describe('resolvePluginPath', () => {
    const userDir = path.join('/mock/user/data', 'plugins');
    const appDir = path.join('/mock/app/path', 'plugins');

    it('should prefer the bundled directory when both have the plugin', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const resolved = await pathService.resolvePluginPath('p1');
      expect(resolved).toBe(path.join(appDir, 'p1'));
    });

    it('should resolve plugin in user directory if it is not bundled', async () => {
      vi.mocked(fs.access).mockImplementation(async (p: any) => {
        if (p.toString().includes(userDir)) return undefined;
        throw new Error('No access');
      });

      const resolved = await pathService.resolvePluginPath('p1');
      expect(resolved).toBe(path.join(userDir, 'p1'));
    });

    it('should return null if plugin not found in any directory', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('No access'));

      const resolved = await pathService.resolvePluginPath('p1');
      expect(resolved).toBeNull();
    });
  });
});
