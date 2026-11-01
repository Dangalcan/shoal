import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketplaceService } from '../services/marketplace/marketplace-service';
import path from 'path';
import fs from 'fs/promises';
import { app } from 'electron';
import { isProduction } from '../utils/env-utils';

vi.mock('../utils/env-utils', () => ({
  isProduction: vi.fn(),
}));

// Mock dependencies
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name) => {
      if (name === 'userData') return '/mock/user/data';
      if (name === 'temp') return '/mock/temp';
      return `/mock/${name}`;
    }),
    getAppPath: vi.fn(() => '/mock/app/path'),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
}));

vi.mock('../services/plugins/plugin-manager', () => ({
  pluginManager: {
    refreshDiscovery: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('adm-zip', () => {
  // Use a regular function (not arrow) so it works as a constructor with `new`
  function MockAdmZip(_path: string) {}
  MockAdmZip.prototype.extractAllTo = vi.fn();
  // extractZipSafe (fs-utils) iterates getEntries(); default to an empty archive.
  MockAdmZip.prototype.getEntries = vi.fn(() => []);
  return { default: MockAdmZip };
});

vi.mock('fs', () => {
  const mockWriteStream = {
    on: vi.fn().mockImplementation(function (
      this: any,
      event: string,
      cb: any
    ) {
      if (event === 'finish') setTimeout(cb, 0);
      return this;
    }),
    once: vi.fn(),
    emit: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  };
  return {
    createWriteStream: vi.fn(() => mockWriteStream),
    default: {
      createWriteStream: vi.fn(() => mockWriteStream),
    },
  };
});

vi.mock('stream/promises', () => ({
  pipeline: vi.fn().mockResolvedValue(undefined),
  default: {
    pipeline: vi.fn().mockResolvedValue(undefined),
  },
}));

// Extraction and integrity checks are unit-tested in fs-utils.test.ts;
// here we mock them to focus on install orchestration.
vi.mock('../utils/fs-utils', () => ({
  cleanupTempFile: vi.fn().mockResolvedValue(undefined),
  extractZipSafe: vi.fn().mockResolvedValue(undefined),
  verifyFileChecksum: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('fs/promises', () => {
  const mockFsPromises = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('[]'),
    rm: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    cp: vi.fn().mockResolvedValue(undefined),
  };
  return {
    ...mockFsPromises,
    default: mockFsPromises,
  };
});

vi.mock('node-machine-id', () => ({
  machineIdSync: vi.fn(() => 'test-machine-id'),
}));

// Mock global fetch
global.fetch = vi.fn();

describe('MarketplaceService', () => {
  let service: MarketplaceService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isProduction).mockReturnValue(false);
    vi.mocked(global.fetch).mockReset();
    service = new MarketplaceService();
  });

  describe('getMarketplacePlugins', () => {
    it('should return plugins on success', async () => {
      const mockPlugins = [
        {
          id: 'p1',
          name: 'Plugin 1',
          version: '1.0.0',
          downloadUrl: 'local://test.zip',
        },
      ];
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockPlugins));

      const result = await service.getMarketplacePlugins();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPlugins);
      expect(fs.readFile).toHaveBeenCalled();
    });

    it('should return error on failure', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Read failed'));

      const result = await service.getMarketplacePlugins();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Read failed');
    });

    it('should fetch from backend if successful', async () => {
      const mockData = [{ id: 'p1', name: 'Plugin 1' }];
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      const result = await service.getMarketplacePlugins();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('should handle backend error in production', async () => {
      vi.mocked(isProduction).mockReturnValue(true);
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Error',
      });

      const result = await service.getMarketplacePlugins();
      expect(
        result.success,
        'Result should be success=false in production'
      ).toBe(false);
      expect(result.error).toContain('Backend responded with 500');
      vi.mocked(isProduction).mockReturnValue(false);
    });

    it('should handle JSON object format from backend', async () => {
      const mockData = [{ id: 'p1', name: 'Plugin 1' }];
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockData }),
      });

      const result = await service.getMarketplacePlugins();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });
  });

  describe('getPluginDetails', () => {
    it('should return plugin details on success', async () => {
      const mockPlugins = [
        {
          id: 'p1',
          name: 'Plugin 1',
          version: '1.0.0',
          downloadUrl: 'local://test.zip',
        },
      ];
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockPlugins));

      const result = await service.getPluginDetails('p1');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPlugins[0]);
    });

    it('should return error if plugin not found', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('[]');

      const result = await service.getPluginDetails('p1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle 404 from backend', async () => {
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await service.getPluginDetails('p1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found in marketplace');
    });

    it('should handle backend error in production for details', async () => {
      vi.mocked(isProduction).mockReturnValue(true);
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Error',
      });

      const result = await service.getPluginDetails('p1');
      expect(
        result.success,
        'Result should be success=false for details in production'
      ).toBe(false);
      expect(result.error).toContain('Backend responded with 500');
      vi.mocked(isProduction).mockReturnValue(false);
    });

    it('should handle fetch exception in production for details', async () => {
      vi.mocked(isProduction).mockReturnValue(true);
      vi.mocked(global.fetch as any).mockRejectedValue(
        new Error('Network error')
      );

      const result = await service.getPluginDetails('p1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      vi.mocked(isProduction).mockReturnValue(false);
    });
  });

  describe('checkForUpdates', () => {
    it('should return updates', async () => {
      const mockPlugins = [
        { id: 'p1', version: '1.1.0', downloadUrl: 'local://test.zip' },
      ];
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockPlugins));

      const result = await service.checkForUpdates([
        { id: 'p1', version: '1.0.0' },
      ]);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect((result.data as any[])[0].latestVersion).toBe('1.1.0');
    });
  });

  describe('isNewer', () => {
    it('should compare correctly', () => {
      expect(service.isNewer('1.1.0', '1.0.0')).toBe(true);
      expect(service.isNewer('1.0.1', '1.0.0')).toBe(true);
      expect(service.isNewer('2.0.0', '1.9.9')).toBe(true);
      expect(service.isNewer('1.0.0', '1.0.0')).toBe(false);
      expect(service.isNewer('0.9.9', '1.0.0')).toBe(false);
      expect(service.isNewer('1.0.0', '1.1.0')).toBe(false);
    });

    it('should handle incomplete versions', () => {
      expect(service.isNewer('1.1', '1.0.0')).toBe(true);
      expect(service.isNewer('1.0.0', '1')).toBe(false);
    });
  });

  describe('installPlugin', () => {
    it('should fail with a clear error when bundled source is not found', async () => {
      const mockPlugin = {
        id: 'p1',
        name: 'Plugin 1',
        version: '1.0.0',
        downloadUrl: 'local://p1.zip',
        manifest: { id: 'p1', version: '1.0.0', main: 'index.js' },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([mockPlugin]));

      // Source directory does not exist — should fail loudly, not write dummy stubs.
      vi.mocked(fs.access).mockRejectedValueOnce(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );

      const result = await service.installPlugin('p1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Bundled plugin source not found');
      // No dummy files should be written
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should install plugin from local source using fs.cp if available', async () => {
      const mockPlugin = {
        id: 'p1',
        name: 'Plugin 1',
        version: '1.0.0',
        downloadUrl: 'local://p1.zip',
        manifest: { id: 'p1', version: '1.0.0', main: 'index.js' },
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([mockPlugin]));
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);

      const result = await service.installPlugin('p1');
      expect(result.success).toBe(true);
      expect(fs.cp).toHaveBeenCalled();
    });

    it('should fail gracefully when fs.cp throws during local install', async () => {
      const mockPlugin = {
        id: 'p1',
        name: 'Plugin 1',
        version: '1.0.0',
        downloadUrl: 'local://p1.zip',
        manifest: {
          id: 'p1',
          version: '1.0.0',
          main: 'index.js',
          renderer: 'renderer.js',
        },
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([mockPlugin]));
      // Source exists but fs.cp fails (e.g. permissions error)
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);
      vi.mocked(fs.cp).mockRejectedValueOnce(new Error('Permission denied'));

      const result = await service.installPlugin('p1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
      // No dummy stub files should be written as a fallback
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should throw if downloadUrl has an unsupported scheme', async () => {
      const mockPlugin = {
        id: 'p1',
        name: 'Plugin 1',
        version: '1.0.0',
        downloadUrl: 'ftp://remote.zip',
        manifest: { id: 'p1', version: '1.0.0', main: 'index.js' },
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([mockPlugin]));

      const result = await service.installPlugin('p1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported download URL scheme');
    });

    it('should handle installation errors', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(
        new Error('Marketplace data missing')
      );
      const result = await service.installPlugin('p1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Marketplace data missing');
    });

    it('should succeed when plugin has no manifest field in marketplace entry (manifest comes from bundle)', async () => {
      // In the new architecture the manifest is read from the installed plugin bundle,
      // not from the marketplace catalog entry. A missing manifest field is fine.
      const mockPlugin = {
        id: 'p1',
        name: 'Plugin 1',
        version: '1.0.0',
        downloadUrl: 'local://p1.zip',
        // manifest intentionally absent — the bundle provides it
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([mockPlugin]));

      const result = await service.installPlugin('p1');
      expect(result.success).toBe(true);
    });

    it('should install plugin via HTTP download', async () => {
      const mockPlugin = {
        id: 'p1',
        name: 'Plugin 1',
        version: '1.0.0',
        downloadUrl: 'https://example.com/p1.zip',
        manifest: { id: 'p1', version: '1.0.0', main: 'index.js' },
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([mockPlugin]));

      const mockBody = { pipe: vi.fn() };
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: mockBody,
      });

      const result = await service.installPlugin('p1');
      expect(result.success).toBe(true);
    });

    it('should verify checksum when the marketplace entry provides one', async () => {
      const { verifyFileChecksum, extractZipSafe } =
        await import('../utils/fs-utils');
      const mockPlugin = {
        id: 'p1',
        name: 'Plugin 1',
        version: '1.0.0',
        downloadUrl: 'https://example.com/p1.zip',
        checksum: 'sha256:abc123',
        manifest: { id: 'p1', version: '1.0.0', main: 'index.js' },
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([mockPlugin]));
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: { pipe: vi.fn() },
      });

      const result = await service.installPlugin('p1');
      expect(result.success).toBe(true);
      expect(verifyFileChecksum).toHaveBeenCalledWith(
        expect.any(String),
        'sha256:abc123'
      );
      expect(extractZipSafe).toHaveBeenCalled();
    });

    it('should fail when the archive checksum does not match', async () => {
      const { verifyFileChecksum, extractZipSafe } =
        await import('../utils/fs-utils');
      vi.mocked(verifyFileChecksum).mockRejectedValueOnce(
        new Error('Checksum mismatch: expected abc, got def')
      );
      const mockPlugin = {
        id: 'p1',
        name: 'Plugin 1',
        version: '1.0.0',
        downloadUrl: 'https://example.com/p1.zip',
        checksum: 'sha256:abc123',
        manifest: { id: 'p1', version: '1.0.0', main: 'index.js' },
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([mockPlugin]));
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: { pipe: vi.fn() },
      });

      const result = await service.installPlugin('p1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Checksum mismatch');
      // Must not extract an archive that failed integrity check.
      expect(extractZipSafe).not.toHaveBeenCalled();
    });

    it('should refuse an unchecksummed download in production', async () => {
      vi.mocked(isProduction).mockReturnValue(true);
      const { extractZipSafe } = await import('../utils/fs-utils');
      const mockPlugin = {
        id: 'p1',
        name: 'Plugin 1',
        version: '1.0.0',
        downloadUrl: 'https://example.com/p1.zip',
        // no checksum
        manifest: { id: 'p1', version: '1.0.0', main: 'index.js' },
      };
      // getPluginDetails (backend) then the file download.
      vi.mocked(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockPlugin,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          body: { pipe: vi.fn() },
        });

      const result = await service.installPlugin('p1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('no checksum');
      expect(extractZipSafe).not.toHaveBeenCalled();
    });

    it('should reject a plugin id that would escape the plugins directory', async () => {
      const result = await service.installPlugin('../../evil');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid plugin ID');
    });

    it('should fail when HTTP download returns non-ok status', async () => {
      const mockPlugin = {
        id: 'p1',
        name: 'Plugin 1',
        version: '2.0.0',
        downloadUrl: 'https://example.com/p1.zip',
        manifest: { id: 'p1', version: '2.0.0', main: 'index.js' },
      };

      // First fetch: getPluginDetails succeeds and returns the plugin entry.
      // Second fetch: the actual file download returns a non-ok status.
      vi.mocked(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockPlugin,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          body: null,
        });

      const result = await service.installPlugin('p1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Download failed');
    });
  });

  describe('checkForUpdates – additional branches', () => {
    it('should return empty array when no installed plugins provided', async () => {
      const result = await service.checkForUpdates([]);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      // readFile should not be called since we short-circuit
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('should not include plugin in updates when versions are equal', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify([{ id: 'p1', version: '1.0.0' }])
      );
      const result = await service.checkForUpdates([
        { id: 'p1', version: '1.0.0' },
      ]);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should not include plugin when marketplace version is older', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify([{ id: 'p1', version: '0.9.0' }])
      );
      const result = await service.checkForUpdates([
        { id: 'p1', version: '1.0.0' },
      ]);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should return error when loadLocalMarketplaceData fails', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));
      const result = await service.checkForUpdates([
        { id: 'p1', version: '1.0.0' },
      ]);
      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });
  });

  describe('loadLocalMarketplaceData – packaged app path', () => {
    it('should use resourcesPath when app is packaged', async () => {
      // Simulate packaged app
      (app as any).isPackaged = true;
      vi.mocked(fs.readFile).mockResolvedValue('[]');

      await service.getMarketplacePlugins();

      // Should not call getAppPath for the data path when packaged
      // (uses process.resourcesPath instead)
      (app as any).isPackaged = false;
    });
  });

  describe('isNewer - additional cases', () => {
    it('should return false if coercion fails', () => {
      expect(service.isNewer('invalid', '1.0.0')).toBe(false);
      expect(service.isNewer('1.0.0', 'invalid')).toBe(false);
    });
  });

  describe('createCheckout', () => {
    it('posts pluginId + machineId and returns the session', async () => {
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ sessionId: 'cs_1', url: 'https://pay/cs_1' }),
      });

      const res = await service.createCheckout('paid-plugin');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toEqual({
          sessionId: 'cs_1',
          url: 'https://pay/cs_1',
        });
      }

      const [url, init] = vi.mocked(global.fetch as any).mock.calls[0];
      expect(String(url)).toMatch(/\/checkout$/);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({
        pluginId: 'paid-plugin',
        machineId: 'test-machine-id',
      });
    });

    it('returns a failure Result on a non-ok response', async () => {
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Seller payouts not set up' }),
      });
      const res = await service.createCheckout('paid-plugin');
      expect(res.success).toBe(false);
      if (!res.success) expect(res.error).toMatch(/payouts/);
    });

    it('rejects an invalid plugin id before calling fetch', async () => {
      const res = await service.createCheckout('../evil');
      expect(res.success).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns a failure Result when fetch throws', async () => {
      vi.mocked(global.fetch as any).mockRejectedValue(new Error('network'));
      const res = await service.createCheckout('paid-plugin');
      expect(res.success).toBe(false);
    });

    it('falls back to the HTTP status when the error body is not JSON', async () => {
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      });

      const res = await service.createCheckout('paid-plugin');

      expect(res).toEqual({ success: false, error: 'HTTP 502' });
    });

    it('falls back to the HTTP status when the error body has no message', async () => {
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({}),
      });

      const res = await service.createCheckout('paid-plugin');

      expect(res).toEqual({ success: false, error: 'HTTP 400' });
    });
  });

  describe('checkForUpdates – production', () => {
    it('reports the backend error instead of reading the local data', async () => {
      vi.mocked(isProduction).mockReturnValue(true);
      vi.mocked(global.fetch as any).mockRejectedValue(
        new Error('getaddrinfo ENOTFOUND')
      );

      const res = await service.checkForUpdates([
        { id: 'plugin-a', version: '1.0.0' },
      ]);

      expect(res).toEqual({
        success: false,
        error: 'getaddrinfo ENOTFOUND',
      });
      expect(fs.readFile).not.toHaveBeenCalled();
    });
  });

  describe('installPlugin – empty details', () => {
    it('fails with a generic message when the backend returns no plugin', async () => {
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => null,
      });

      const res = await service.installPlugin('test-plugin');

      expect(res).toEqual({
        success: false,
        error: 'Could not find plugin in marketplace',
      });
      expect(fs.mkdir).not.toHaveBeenCalled();
    });
  });

  describe('getCheckoutStatus', () => {
    it('returns the paid status + license key', async () => {
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'paid', licenseKey: 'LIC-1' }),
      });
      const res = await service.getCheckoutStatus('cs_1');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toEqual({ status: 'paid', licenseKey: 'LIC-1' });
      }
      const [url] = vi.mocked(global.fetch as any).mock.calls[0];
      expect(String(url)).toMatch(/\/checkout\/cs_1$/);
    });

    it('returns a failure Result on a non-ok response', async () => {
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
      });
      const res = await service.getCheckoutStatus('missing');
      expect(res.success).toBe(false);
    });

    it('returns a failure Result when the request throws', async () => {
      vi.mocked(global.fetch as any).mockRejectedValue(
        new Error('The operation was aborted due to timeout')
      );

      const res = await service.getCheckoutStatus('cs_1');

      expect(res).toEqual({
        success: false,
        error: 'The operation was aborted due to timeout',
      });
    });
  });
});
