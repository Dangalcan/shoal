import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginLoader } from '../services/plugins/plugin-loader';
import fs from 'fs/promises';
import path from 'path';

// Helper to handle path separators consistently
const fixPath = (p: string) => p.replace(/\\/g, '/');

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

vi.mock('fs/promises', () => {
  const mockFs = {
    readdir: vi.fn(),
    readFile: vi.fn(),
    access: vi.fn(),
    stat: vi.fn(),
  };
  return {
    ...mockFs,
    default: mockFs,
  };
});

describe('PluginLoader', () => {
  let loader: PluginLoader;

  beforeEach(() => {
    vi.clearAllMocks();
    loader = new PluginLoader();
    // Default success for access
    vi.mocked(fs.access).mockResolvedValue(undefined);
  });

  describe('discoverPlugins', () => {
    it('should discover plugins in directories', async () => {
      vi.mocked(fs.readdir).mockImplementation(async (dir: any) => {
        const normalized = fixPath(dir.toString());
        if (normalized.includes('/mock/user/data/plugins')) {
          return [{ isDirectory: () => true, name: 'plugin1' } as any];
        }
        return [];
      }) as any;

      const manifest = {
        id: 'p1',
        name: 'P1',
        version: '1.0.0',
        description: 'D',
        author: 'A',
        main: 'index.js',
        permissions: [],
        license: { type: 'free', spdx: 'MIT' },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(manifest));

      const plugins = await loader.discoverPlugins();
      expect(plugins).toHaveLength(1);
      expect(plugins[0].manifest.id).toBe('p1');
    });
  });

  describe('validateManifest', () => {
    it('should catch validation errors', async () => {
      const baseManifest = {
        id: 'p1',
        name: 'P1',
        version: '1.0.0',
        description: 'D',
        author: 'A',
        main: 'index.js',
        permissions: [],
        license: { type: 'free', spdx: 'MIT' },
      };

      const testErr = async (m: any, err: string) => {
        vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(m));
        const p = await loader.loadPluginFromDirectory('/p');
        expect(p?.state).toBe('error');
        expect(p?.error).toContain(err);
      };

      await testErr({ ...baseManifest, id: 'bad id!' }, 'Invalid plugin ID');
      await testErr({ ...baseManifest, version: '1.0' }, 'Invalid version');
      await testErr(
        { ...baseManifest, permissions: ['bad'] },
        'Invalid permission'
      );
      await testErr(
        { ...baseManifest, license: { type: 'paid' } },
        'pricing information'
      );
    });
  });

  describe('loadPluginFromDirectory', () => {
    it('should return null on critical failures', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('READ_FAIL'));
      const p = await loader.loadPluginFromDirectory('/p');
      expect(p).toBeNull();
    });

    it('should handle optional renderer existence', async () => {
      const manifest = {
        id: 'p1',
        name: 'P1',
        version: '1.0.0',
        description: 'D',
        author: 'A',
        main: 'index.js',
        permissions: [],
        license: { type: 'free', spdx: 'MIT' },
        renderer: 'r.js',
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(manifest));
      vi.mocked(fs.access).mockImplementation(async (p: any) => {
        if (fixPath(p.toString()).includes('r.js')) throw new Error('ENOENT');
        return undefined;
      }) as any;

      const p = await loader.loadPluginFromDirectory('/p');
      expect(p?.rendererEntry).toBeUndefined();
    });
  });

  describe('State management', () => {
    it('updatePluginState should update a registered plugin', () => {
      const p = { manifest: { id: 'p1' } } as any;
      loader.registerPlugin(p);
      loader.updatePluginState('p1', 'loading', 'err');
      expect(loader.getPlugin('p1')?.state).toBe('loading');
      expect(loader.getPlugin('p1')?.error).toBe('err');

      loader.updatePluginState('p1', 'enabled');
      expect(loader.getPlugin('p1')?.error).toBeUndefined();
    });
  });
});
