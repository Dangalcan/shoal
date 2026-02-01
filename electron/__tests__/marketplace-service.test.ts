import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketplaceService } from '../services/marketplace/marketplace-service';
import path from 'path';
import fs from 'fs/promises';
import { app } from 'electron';

// Mock dependencies
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  },
}));

// Mock global fetch
global.fetch = vi.fn();

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

    it('should return error on network failure', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const result = await service.getMarketplacePlugins();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
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

    it('should return error if not found', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
      } as any);

      const result = await service.getPluginDetails('p1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
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

    it('should return empty if input is empty', async () => {
      const result = await service.checkForUpdates([]);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('isNewer', () => {
    it('should compare correctly', () => {
      expect(service.isNewer('1.1.0', '1.0.0')).toBe(true);
      expect(service.isNewer('1.0.1', '1.0.0')).toBe(true);
      expect(service.isNewer('2.0.0', '1.9.9')).toBe(true);
      expect(service.isNewer('1.0.0', '1.0.0')).toBe(false);
      expect(service.isNewer('1.0.0', '1.1.0')).toBe(false);
      expect(service.isNewer('0.9.0', '1.0.0')).toBe(false);
    });
  });

  describe('installPlugin', () => {
    it('should install plugin successfully', async () => {
      const mockPlugin = {
        id: 'p1',
        name: 'Plugin 1',
        version: '1.0.0',
        description: 'desc',
        author: 'auth',
        price: 0,
      };

      // Spy on getPluginDetails
      vi.spyOn(service, 'getPluginDetails').mockResolvedValue({
        success: true,
        data: mockPlugin as any,
      });

      // Mock the delay in the service if possible, or just increase timeout
      // Since it's a hardcoded Promise in the service, let's use a long timeout for the test
      const result = await service.installPlugin('p1');

      expect(result.success).toBe(true);
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    }, 10000); // 10s timeout

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
