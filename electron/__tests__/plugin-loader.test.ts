import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginLoader } from '../services/plugins/plugin-loader';
import { createErrorPlugin } from '../services/plugins/plugin-validator';
import fs from 'fs/promises';

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

vi.mock('../services/plugins/path-service', () => ({
  pathService: {
    getDiscoveryDirectories: vi
      .fn()
      .mockReturnValue(['/mock/user/data/plugins', '/mock/app/path/plugins']),
    resolvePluginPath: vi.fn(),
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
          return [
            { isDirectory: () => true, name: 'plugin1' },
            { isDirectory: () => false, name: 'somefile.txt' }, // Cover file branch
          ] as any;
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
        permissions: ['ui'],
        license: { type: 'free', spdx: 'MIT' },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(manifest));

      const plugins = await loader.discoverPlugins();
      expect(plugins).toHaveLength(1);
      expect(plugins[0].manifest.id).toBe('p1');
    });

    it('should handle directory access failures', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      const plugins = await loader.discoverPlugins();
      expect(plugins).toHaveLength(0);
    });
  });

  describe('validateManifest', () => {
    const baseManifest = {
      id: 'p1',
      name: 'P1',
      version: '1.0.0',
      description: 'D',
      author: 'A',
      main: 'index.js',
      permissions: ['ui'],
      license: { type: 'free', spdx: 'MIT' },
    };

    const testErr = async (m: any, err: string) => {
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(m));
      const p = await loader.loadPluginFromDirectory('/p');
      expect(p?.state).toBe('error');
      expect(p?.error).toContain(err);
    };

    it('should catch validation errors', async () => {
      await testErr({ ...baseManifest, id: 'bad id!' }, 'Invalid plugin ID');
      await testErr({ ...baseManifest, version: '1.0' }, 'Invalid version');
      await testErr(
        { ...baseManifest, permissions: ['bad'] },
        'Invalid permission'
      );
    });

    it('should validate missing fields', async () => {
      // Test one missing field to cover the branch; others are similar
      const { id, ...noId } = baseManifest;
      await testErr(noId, 'Missing required field');
    });

    it('should validate invalid license type', async () => {
      await testErr(
        { ...baseManifest, license: { type: 'unknown' } },
        'Invalid license type'
      );
    });

    it('should validate paid plugins pricing', async () => {
      await testErr(
        { ...baseManifest, license: { type: 'paid' } },
        'pricing information'
      );
      await testErr(
        { ...baseManifest, license: { type: 'paid', pricing: { price: 0 } } },
        'Invalid pricing'
      );
      await testErr(
        { ...baseManifest, license: { type: 'paid', pricing: { price: 10 } } },
        'currency is required'
      );
    });

    it('should validate dependencies', async () => {
      await testErr(
        { ...baseManifest, dependencies: { 'bad id!': '1.0.0' } },
        'Invalid dependency ID'
      );
      await testErr(
        { ...baseManifest, dependencies: { dep1: 'bad-version' } },
        'Invalid version constraint'
      );
    });
  });

  describe('loadPluginFromDirectory', () => {
    it('should return null on critical failures', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('READ_FAIL'));
      const p = await loader.loadPluginFromDirectory('/p');
      expect(p).toBeNull();
    });

    it('should handle signature verification failure', async () => {
      const { signatureService } =
        await import('../services/security/signature-service');
      vi.mocked(signatureService.verifyPlugin).mockResolvedValueOnce(false);

      const manifest = {
        id: 'p1',
        name: 'P1',
        version: '1.0.0',
        description: 'D',
        author: 'A',
        main: 'index.js',
        permissions: ['ui'],
        license: { type: 'free', spdx: 'MIT' },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(manifest));
      const p = await loader.loadPluginFromDirectory('/p');
      expect(p?.state).toBe('error');
      expect(p?.error).toContain('Signature verification failed');
    });

    it('should resolve existing renderer', async () => {
      const manifest = {
        id: 'p1',
        name: 'P1',
        version: '1.0.0',
        description: 'D',
        author: 'A',
        main: 'index.js',
        permissions: ['ui'],
        license: { type: 'free', spdx: 'MIT' },
        renderer: 'r.js',
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(manifest));
      vi.mocked(fs.access).mockResolvedValue(undefined); // All exist

      const p = await loader.loadPluginFromDirectory('/p');
      expect(fixPath(p?.rendererEntry || '')).toContain('r.js');
    });

    it('should handle optional renderer existence', async () => {
      const manifest = {
        id: 'p1',
        name: 'P1',
        version: '1.0.0',
        description: 'D',
        author: 'A',
        main: 'index.js',
        permissions: ['ui'],
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

    it('should handle renderer styles', async () => {
      const manifest = {
        id: 'p1',
        name: 'P1',
        version: '1.0.0',
        description: 'D',
        author: 'A',
        main: 'index.js',
        permissions: ['ui'],
        license: { type: 'free', spdx: 'MIT' },
        styles: ['s1.css', 's2.css'],
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(manifest));
      vi.mocked(fs.access).mockImplementation(async (p: any) => {
        if (fixPath(p.toString()).includes('s2.css')) throw new Error('ENOENT');
        return undefined;
      }) as any;

      const p = await loader.loadPluginFromDirectory('/p');
      expect(p?.rendererStyles).toHaveLength(1);
      expect(fixPath(p?.rendererStyles![0] || '')).toContain('s1.css');
    });
  });

  describe('Lifecycle methods', () => {
    it('loadPluginCode should load module and return it', async () => {
      const p = { manifest: { id: 'p1', main: 'idx.js' } } as any;
      loader.registerPlugin(p);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      // Return plain CommonJS JS — the sandbox cannot handle TypeScript syntax
      vi.mocked(fs.readFile).mockResolvedValue(
        'module.exports = { start: function() { return 42; } };' as any
      );

      const result = await loader.loadPluginCode('p1', '/p');
      expect(result).toBeDefined();
      expect(typeof result.start).toBe('function');
      expect((result.start as () => unknown)()).toBe(42);
    });

    it('loadPluginCode should throw if plugin not registered', async () => {
      await expect(loader.loadPluginCode('none', '/p')).rejects.toThrow(
        'not found'
      );
    });

    it('unloadPluginCode should clear the sandbox cache', async () => {
      const p = { manifest: { id: 'p1', main: 'idx.js' } } as any;
      loader.registerPlugin(p);

      // Load the plugin to populate the sandbox cache
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('module.exports = {};' as any);
      await loader.loadPluginCode('p1', '/mock-plugins');

      // Unload should succeed without throwing
      await expect(
        loader.unloadPluginCode('p1', '/mock-plugins')
      ).resolves.toBeUndefined();
    });

    it('unloadPluginCode should do nothing if plugin not registered', async () => {
      await loader.unloadPluginCode('none', '/p');
    });

    it('unregisterPlugin should remove from map', () => {
      const p = { manifest: { id: 'p1' } } as any;
      loader.registerPlugin(p);
      expect(loader.getPlugin('p1')).toBeDefined();
      loader.unregisterPlugin('p1');
      expect(loader.getPlugin('p1')).toBeUndefined();
    });

    it('getAllPlugins should return all values', () => {
      loader.registerPlugin({ manifest: { id: 'p1' } } as any);
      loader.registerPlugin({ manifest: { id: 'p2' } } as any);
      expect(loader.getAllPlugins()).toHaveLength(2);
    });

    it('getPluginPath should use pathService', async () => {
      const { pathService } = await import('../services/plugins/path-service');
      vi.mocked(pathService.resolvePluginPath).mockResolvedValue('/mock/path');

      const p = await loader.getPluginPath('p1');
      expect(p).toBe('/mock/path');
      expect(pathService.resolvePluginPath).toHaveBeenCalledWith('p1');
    });
  });

  describe('Error handling', () => {
    it('createErrorPlugin should use defaults for missing manifest fields', () => {
      const p = createErrorPlugin({}, 'Some error');
      expect(p.manifest.id).toBe('unknown');
      expect(p.manifest.name).toBe('Unknown Plugin');
      expect(p.manifest.version).toBe('0.0.0');
      expect(p.state).toBe('error');
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

    it('updatePluginState should do nothing if plugin not found', () => {
      // Should not throw
      loader.updatePluginState('none', 'enabled');
    });
  });
});
