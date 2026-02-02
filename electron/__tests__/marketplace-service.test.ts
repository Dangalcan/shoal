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

// Mock global fetch (still needed for types/globals but unused for main logic now)
global.fetch = vi.fn();

describe('MarketplaceService', () => {
  let service: MarketplaceService;

  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(result.data![0].version).toBe('1.1.0');
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
        downloadUrl: 'local://p1.zip',
        manifest: { id: 'p1', version: '1.0.0', main: 'index.js' },
      };

      // Mock getPluginDetails via readFile
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([mockPlugin]));

      // Force dummy install by making access fail
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('No source'));

      const result = await service.installPlugin('p1');
      expect(result.success).toBe(true);
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});
