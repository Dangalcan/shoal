import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketplaceService } from '../services/marketplace/marketplace-service';
import path from 'path';
import fs from 'fs/promises';
import { app } from 'electron';

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
  const MockZip = vi.fn().mockImplementation(() => ({
    extractAllTo: vi.fn(),
  }));
  return {
    default: MockZip,
  };
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

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock global fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
  body: {},
} as any);

describe('MarketplaceService', () => {
  let service: MarketplaceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MarketplaceService();
  });

  describe('getMarketplacePlugins', () => {
    it('should return plugins on success', async () => {
      const mockPlugins = [{ id: 'p1', name: 'Plugin 1' }];
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPlugins),
      } as any);

      const result = await service.getMarketplacePlugins();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPlugins);
    });

    it('should return error on failure', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      } as any);

      const result = await service.getMarketplacePlugins();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not Found');
    });
  });

  describe('getPluginDetails', () => {
    it('should return plugin details on success', async () => {
      const mockPlugin = { id: 'p1', name: 'Plugin 1' };
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPlugin),
      } as any);

      const result = await service.getPluginDetails('p1');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPlugin);
    });
  });

  describe('checkForUpdates', () => {
    it('should return updates', async () => {
      const mockUpdates = [{ id: 'p1', latestVersion: '1.1.0' }];
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUpdates),
      } as any);

      const result = await service.checkForUpdates([
        { id: 'p1', version: '1.0.0' },
      ]);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdates);
    });
  });

  describe('isNewer', () => {
    it('should compare correctly', () => {
      expect(service.isNewer('1.1.0', '1.0.0')).toBe(true);
      expect(service.isNewer('1.0.0', '1.1.0')).toBe(false);
    });
  });

  describe('installPlugin', () => {
    it('should install plugin successfully', async () => {
      const mockPlugin = {
        id: 'p1',
        name: 'Plugin 1',
        version: '1.0.0',
        downloadUrl: 'http://example.com/p1.zip',
      };

      vi.spyOn(service, 'getPluginDetails').mockResolvedValue({
        success: true,
        data: mockPlugin as any,
      });

      // Mock internal methods to isolate
      vi.spyOn(service as any, 'downloadPlugin').mockResolvedValue(undefined);
      vi.spyOn(service as any, 'extractPlugin').mockResolvedValue(undefined);

      const result = await service.installPlugin('p1');
      expect(result.success).toBe(true);
    }, 10000);

    it('should handle failure during installation', async () => {
      vi.spyOn(service, 'getPluginDetails').mockResolvedValue({
        success: false,
        error: 'Fetch failed',
      });

      const result = await service.installPlugin('p1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Fetch failed');
    });
  });
});
