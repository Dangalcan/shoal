import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginManager } from '../services/plugins/plugin-manager';
import { pluginLoader } from '../services/plugins/plugin-loader';
import { pluginRegistry } from '../services/plugins/plugin-registry';
import { licenseManager } from '../services/security/license-manager';

// Mock dependencies
vi.mock('../services/plugins/plugin-loader', () => ({
  pluginLoader: {
    getPlugins: vi.fn(),
    getPluginPath: vi.fn(),
    loadPluginCode: vi.fn(),
    unloadPluginCode: vi.fn(),
    registerPlugin: vi.fn(),
    updatePluginState: vi.fn(),
  },
}));

vi.mock('../services/plugins/plugin-registry', () => ({
  pluginRegistry: {
    initialize: vi.fn(),
    getPlugin: vi.fn(),
    getAllPlugins: vi.fn(),
    getEnabledPlugins: vi.fn(),
    registerPlugin: vi.fn(),
    unregisterPlugin: vi.fn(),
    updatePluginState: vi.fn(),
    enablePlugin: vi.fn(),
    disablePlugin: vi.fn(),
    hasPlugin: vi.fn(),
    isPluginEnabled: vi.fn(),
    setPluginContext: vi.fn(),
    clearPluginContext: vi.fn(),
    getPluginSettings: vi.fn(),
    updatePluginSettings: vi.fn(),
  },
}));

vi.mock('../services/security/license-manager', () => ({
  licenseManager: {
    checkLicense: vi.fn(),
  },
}));

vi.mock('../services/marketplace/marketplace-service', () => ({
  marketplaceService: {
    checkForUpdates: vi.fn(),
  },
}));

vi.mock('../services/plugins/plugin-context', () => ({
  createPluginContext: vi.fn(),
  getAllPluginExtensions: vi.fn(),
}));

import { marketplaceService } from '../services/marketplace/marketplace-service';
import { getAllPluginExtensions } from '../services/plugins/plugin-context';

describe('PluginManager', () => {
  let pluginManager: PluginManager;

  beforeEach(() => {
    vi.clearAllMocks();
    pluginManager = new PluginManager();
  });

  describe('enablePlugin', () => {
    it('should activate a valid plugin successfully', async () => {
      const pluginId = 'test-plugin';
      const mockPlugin = {
        manifest: { id: pluginId, permissions: ['ui'] },
        state: 'disabled',
      };

      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: mockPlugin as any,
        config: { enabled: true },
      });
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue(
        '/path/to/plugin'
      );
      vi.mocked(licenseManager.checkLicense).mockReturnValue({ valid: true });

      const activateMock = vi.fn();
      vi.mocked(pluginLoader.loadPluginCode).mockResolvedValue({
        activate: activateMock,
        deactivate: vi.fn(),
      });

      await pluginManager.enablePlugin(pluginId);

      expect(activateMock).toHaveBeenCalled();
      expect(pluginRegistry.enablePlugin).toHaveBeenCalledWith(pluginId);
      expect(pluginLoader.updatePluginState).toHaveBeenCalledWith(
        pluginId,
        'enabled'
      );
    });

    it('should throw if license is invalid', async () => {
      const pluginId = 'paid-plugin';
      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: { manifest: { id: pluginId } } as any,
        config: { enabled: true },
      });
      vi.mocked(licenseManager.checkLicense).mockReturnValue({
        valid: false,
        error: 'License expired',
      });

      await expect(pluginManager.enablePlugin(pluginId)).rejects.toThrow(
        'License validation failed: License expired'
      );
    });
  });

  describe('checkForUpdates', () => {
    it('should check and apply updates', async () => {
      vi.mocked(pluginRegistry.getAllPlugins).mockReturnValue([
        { manifest: { id: 'p1', version: '1.0.0' } } as any,
      ]);

      vi.mocked(marketplaceService.checkForUpdates).mockResolvedValue({
        success: true,
        data: [{ pluginId: 'p1', hasUpdate: true, latestVersion: '1.1.0' }],
      } as any);

      // We need to access the plugin object to verify mutation
      const pluginObj = {
        manifest: { id: 'p1', version: '1.0.0' },
        hasUpdate: false,
        latestVersion: '',
      };
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: pluginObj as any,
        config: { enabled: true },
      });

      await pluginManager.checkForUpdates();

      expect(marketplaceService.checkForUpdates).toHaveBeenCalled();
      expect(pluginObj.hasUpdate).toBe(true);
      expect(pluginObj.latestVersion).toBe('1.1.0');
    });
  });

  describe('executePluginAction', () => {
    it('should execute action successfully', async () => {
      const pluginId = 'action-plugin';
      const actionFn = vi.fn().mockReturnValue('result');

      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: { manifest: { id: pluginId } } as any,
        config: { enabled: true },
      });
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(true);
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
      vi.mocked(pluginLoader.loadPluginCode).mockResolvedValue({
        myAction: actionFn,
      });

      const result = await pluginManager.executePluginAction(
        pluginId,
        'myAction',
        'args'
      );

      expect(result).toBe('result');
      expect(actionFn).toHaveBeenCalledWith('args');
    });

    it('should throw if plugin not found or disabled', async () => {
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue(undefined);
      await expect(
        pluginManager.executePluginAction('missing', 'act')
      ).rejects.toThrow('not found');

      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({} as any);
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(false);
      await expect(
        pluginManager.executePluginAction('disabled', 'act')
      ).rejects.toThrow('not enabled');
    });
  });

  describe('getPluginExtensions', () => {
    it('should return extensions for enabled plugins', () => {
      const extensionsMap = new Map();
      extensionsMap.set('p1', { sidebar: ['item1'] });
      extensionsMap.set('p2', { sidebar: ['item2'] });

      vi.mocked(getAllPluginExtensions).mockReturnValue(extensionsMap);
      vi.mocked(pluginRegistry.isPluginEnabled).mockImplementation(
        (id) => id === 'p1'
      );

      const result = pluginManager.getPluginExtensions('sidebar');

      expect(result).toEqual(['item1']);
      expect(result).not.toContain('item2');
    });
  });

  describe('disablePlugin', () => {
    it('should deactivate an enabled plugin', async () => {
      const pluginId = 'active-plugin';
      const deactivateMock = vi.fn();

      const mockPlugin = {
        manifest: { id: pluginId },
        state: 'enabled',
      };

      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: mockPlugin as any,
        config: { enabled: true },
      });
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');

      vi.mocked(pluginLoader.loadPluginCode).mockResolvedValue({
        activate: vi.fn(),
        deactivate: deactivateMock,
      });

      await pluginManager.disablePlugin(pluginId);

      expect(deactivateMock).toHaveBeenCalled();
      expect(pluginRegistry.disablePlugin).toHaveBeenCalledWith(pluginId);
      expect(pluginLoader.updatePluginState).toHaveBeenCalledWith(
        pluginId,
        'disabled'
      );
    });
  });

  describe('reloadPlugin', () => {
    it('should deactivate, unload, and reactivate', async () => {
      const pluginId = 'reload-plugin';
      const deactivateMock = vi.fn();
      const activateMock = vi.fn();

      const mockPlugin = {
        manifest: { id: pluginId },
        state: 'enabled',
      };

      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: mockPlugin as any,
        config: { enabled: true },
      });
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
      vi.mocked(licenseManager.checkLicense).mockReturnValue({ valid: true });
      vi.mocked(pluginLoader.loadPluginCode).mockResolvedValue({
        activate: activateMock,
        deactivate: deactivateMock,
      });

      await pluginManager.reloadPlugin(pluginId);

      expect(deactivateMock).toHaveBeenCalled();
      expect(pluginLoader.unloadPluginCode).toHaveBeenCalledWith(
        pluginId,
        '/path'
      );
      expect(activateMock).toHaveBeenCalled();
    });
  });

  describe('Additional Branch Coverage', () => {
    it('enablePlugin should throw if plugin not in registry', async () => {
      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(false);
      await expect(pluginManager.enablePlugin('ghost')).rejects.toThrow(
        'not found'
      );
    });

    it('checkForUpdates should handle marketplace service failure', async () => {
      vi.mocked(pluginRegistry.getAllPlugins).mockReturnValue([]);
      vi.mocked(marketplaceService.checkForUpdates).mockResolvedValue({
        success: false,
        error: 'Network error',
      } as any);

      // The implementation doesn't actually log if result.success is false here
      await pluginManager.checkForUpdates();
      expect(marketplaceService.checkForUpdates).toHaveBeenCalled();
    });

    it('getPluginExtensions should handle missing extension point', () => {
      const extensionsMap = new Map();
      extensionsMap.set('p1', { other: [] });
      vi.mocked(getAllPluginExtensions).mockReturnValue(extensionsMap);
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(true);

      const result = pluginManager.getPluginExtensions('sidebar');
      expect(result).toEqual([]);
    });

    it('executePluginAction should throw if action not found in code', async () => {
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: { manifest: { id: 'p' } },
      } as any);
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(true);
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
      vi.mocked(pluginLoader.loadPluginCode).mockResolvedValue({
        /* no actions */
      });

      await expect(
        pluginManager.executePluginAction('p', 'missing')
      ).rejects.toThrow('not found in plugin p');
    });

    it('disablePlugin should handle deactivate error', async () => {
      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: { manifest: { id: 'p' } },
      } as any);
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
      vi.mocked(pluginLoader.loadPluginCode).mockRejectedValue(
        new Error('fail')
      );

      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // The inner catch at line 289 swallows the error during loadPluginCode/deactivate
      await pluginManager.disablePlugin('p');
      expect(pluginRegistry.disablePlugin).toHaveBeenCalledWith('p');
      logSpy.mockRestore();
    });
  });
});
