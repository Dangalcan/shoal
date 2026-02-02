import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginManager } from '../services/plugins/plugin-manager';
import { pluginLoader } from '../services/plugins/plugin-loader';
import { pluginRegistry } from '../services/plugins/plugin-registry';
import { licenseManager } from '../services/security/license-manager';
import { app } from 'electron';
import path from 'path';

// Mock dependencies
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name) => {
      if (name === 'userData') return '/mock/user/data';
      return `/mock/${name}`;
    }),
  },
}));
vi.mock('../services/plugins/plugin-loader', () => ({
  pluginLoader: {
    getPlugins: vi.fn(),
    getPluginPath: vi.fn(),
    loadPluginCode: vi.fn(),
    unloadPluginCode: vi.fn(),
    registerPlugin: vi.fn(),
    unregisterPlugin: vi.fn(),
    updatePluginState: vi.fn(),
    discoverPlugins: vi.fn(),
    loadPluginFromDirectory: vi.fn(),
    pluginDirectories: ['/mock/plugins'],
  },
}));

vi.mock('../services/plugins/plugin-registry', () => ({
  pluginRegistry: {
    initialize: vi.fn(),
    getPlugin: vi.fn(),
    getAllPlugins: vi.fn(() => []),
    getEnabledPlugins: vi.fn(() => []),
    registerPlugin: vi.fn(),
    unregisterPlugin: vi.fn(),
    updatePluginState: vi.fn(),
    updatePluginConfig: vi.fn(),
    enablePlugin: vi.fn(),
    disablePlugin: vi.fn(),
    hasPlugin: vi.fn(),
    isPluginEnabled: vi.fn(),
    setPluginContext: vi.fn(),
    getPluginContext: vi.fn(),
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
  clearPluginExtensions: vi.fn(),
}));

vi.mock('../services/plugins/dependency-resolver', () => ({
  dependencyResolver: {
    validateDependencies: vi.fn(() => ({ valid: true })),
    getDependents: vi.fn(() => []),
  },
}));

vi.mock('../services/plugins/data-loader', () => ({
  dataLoader: {
    loadPluginData: vi.fn(() => []),
    applyDataToStorage: vi.fn(),
  },
}));

vi.mock('fs', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  const mockPromises = {
    stat: vi.fn(),
    readFile: vi.fn(),
    access: vi.fn(),
    cp: vi.fn(),
    rm: vi.fn(),
  };
  return {
    ...actual,
    default: {
      ...actual.default,
      watch: vi.fn(),
      promises: mockPromises,
    },
    promises: mockPromises,
  };
});

import { marketplaceService } from '../services/marketplace/marketplace-service';
import { getAllPluginExtensions } from '../services/plugins/plugin-context';
import { dependencyResolver } from '../services/plugins/dependency-resolver';
import fs from 'fs';

describe('PluginManager', () => {
  let pluginManager: PluginManager;

  beforeEach(() => {
    vi.clearAllMocks();
    pluginManager = new PluginManager();
    // Set safe defaults
    vi.mocked(licenseManager.checkLicense).mockReturnValue({ valid: true });
    vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
    vi.mocked(pluginLoader.loadPluginCode).mockResolvedValue({});
    vi.mocked(dependencyResolver.validateDependencies).mockReturnValue({
      valid: true,
    } as any);
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
        plugin: mockPlugin,
        config: { enabled: true },
      } as any);
      vi.mocked(licenseManager.checkLicense).mockReturnValue({ valid: true });
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
      vi.mocked(pluginLoader.loadPluginCode).mockResolvedValue({});

      await pluginManager.enablePlugin(pluginId);
      expect(pluginRegistry.enablePlugin).toHaveBeenCalledWith(pluginId);
    });

    it('should execute optional lifecycle hooks during activation', async () => {
      const pluginId = 'test-plugin';
      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: { manifest: { id: pluginId, permissions: [] } },
        config: { enabled: true },
      } as any);

      const mockModule = {
        beforeActivate: vi.fn(),
        activate: vi.fn(),
        afterActivate: vi.fn(),
      };
      vi.mocked(pluginLoader.loadPluginCode).mockResolvedValue(mockModule);

      await pluginManager.enablePlugin(pluginId);

      expect(mockModule.beforeActivate).toHaveBeenCalled();
      expect(mockModule.activate).toHaveBeenCalled();
      expect(mockModule.afterActivate).toHaveBeenCalled();
    });

    it('should throw if license is invalid', async () => {
      const pluginId = 'test-plugin';
      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: { manifest: { id: pluginId } },
      } as any);
      vi.mocked(licenseManager.checkLicense).mockReturnValue({
        valid: false,
        error: 'Invalid license',
      });

      await expect(pluginManager.enablePlugin(pluginId)).rejects.toThrow(
        'License validation failed: Invalid license'
      );
    });
  });

  describe('checkForUpdates', () => {
    it('should check and apply updates', async () => {
      const mockPlugins = [{ manifest: { id: 'p1', version: '1.0.0' } } as any];
      vi.mocked(pluginRegistry.getAllPlugins).mockReturnValue(mockPlugins);
      vi.mocked(marketplaceService.checkForUpdates).mockResolvedValue({
        success: true,
        data: [{ pluginId: 'p1', hasUpdate: true, latestVersion: '1.1.0' }],
      });
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: mockPlugins[0],
      } as any);

      await pluginManager.checkForUpdates();
      expect(mockPlugins[0].hasUpdate).toBe(true);
      expect(mockPlugins[0].latestVersion).toBe('1.1.0');
    });

    it('checkForUpdates should handle marketplace service failure', async () => {
      vi.mocked(marketplaceService.checkForUpdates).mockResolvedValue({
        success: false,
        error: 'Network error',
      });
      // Should not throw
      await pluginManager.checkForUpdates();
    });
  });

  describe('executePluginAction', () => {
    it('should execute action successfully', async () => {
      const pluginId = 'p1';
      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({} as any);
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(true);
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
      vi.mocked(pluginLoader.loadPluginCode).mockResolvedValue({
        myAction: vi.fn().mockResolvedValue('result'),
      });

      const result = await pluginManager.executePluginAction(
        pluginId,
        'myAction',
        'args'
      );
      expect(result).toBe('result');
    });

    it('should throw if plugin not found or disabled', async () => {
      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(false);
      await expect(
        pluginManager.executePluginAction('none', 'act')
      ).rejects.toThrow('not found');

      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({} as any);
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(false);
      await expect(
        pluginManager.executePluginAction('p1', 'act')
      ).rejects.toThrow('not enabled');
    });

    it('executePluginAction should throw if action not found in code', async () => {
      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({} as any);
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(true);
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
      vi.mocked(pluginLoader.loadPluginCode).mockResolvedValue({});

      await expect(
        pluginManager.executePluginAction('p1', 'missing')
      ).rejects.toThrow('not found in plugin');
    });
  });

  describe('getPluginExtensions', () => {
    it('should return extensions for enabled plugins', () => {
      const extensions = { sidebar: [{ id: 's1' }] };
      vi.mocked(getAllPluginExtensions).mockReturnValue(
        new Map([['p1', extensions]])
      );
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(true);

      const results = pluginManager.getPluginExtensions('sidebar');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('s1');
    });

    it('getPluginExtensions should handle missing extension point', () => {
      vi.mocked(getAllPluginExtensions).mockReturnValue(new Map([['p1', {}]]));
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(true);
      const results = pluginManager.getPluginExtensions('sidebar');
      expect(results).toHaveLength(0);
    });
  });

  describe('disablePlugin', () => {
    it('should deactivate an enabled plugin', async () => {
      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(true);
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({} as any);
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
      vi.mocked(pluginLoader.loadPluginCode).mockResolvedValue({});

      await pluginManager.disablePlugin('p1');
      expect(pluginRegistry.disablePlugin).toHaveBeenCalledWith('p1');
    });

    it('should execute optional lifecycle hooks during deactivation', async () => {
      const pluginId = 'p1';
      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(true);
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({} as any);

      const mockModule = {
        beforeDeactivate: vi.fn(),
        deactivate: vi.fn(),
        afterDeactivate: vi.fn(),
      };
      vi.mocked(pluginLoader.loadPluginCode).mockResolvedValue(mockModule);

      await pluginManager.disablePlugin(pluginId);

      expect(mockModule.beforeDeactivate).toHaveBeenCalled();
      expect(mockModule.deactivate).toHaveBeenCalled();
      expect(mockModule.afterDeactivate).toHaveBeenCalled();
    });

    it('disablePlugin should handle deactivation errors', async () => {
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(true);
      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        manifest: { id: 'p1' },
        state: 'enabled',
      } as any);
      vi.mocked(pluginLoader.getPluginPath).mockRejectedValue(
        new Error('Deactivate failed')
      );

      await expect(pluginManager.disablePlugin('p1')).rejects.toThrow(
        'Deactivate failed'
      );
    });

    it('disablePlugin should perform cascading disable', async () => {
      const parentId = 'parent';
      const childId = 'child';
      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.getEnabledPlugins).mockReturnValue([]);
      vi.mocked(dependencyResolver.getDependents).mockImplementation((id) =>
        id === parentId ? [{ manifest: { id: childId } } as any] : []
      );

      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
      vi.mocked(pluginLoader.loadPluginCode).mockResolvedValue({});

      const disableSpy = vi.spyOn(pluginManager, 'disablePlugin');
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: { manifest: { id: childId } },
      } as any);

      await pluginManager.disablePlugin(parentId);
      expect(disableSpy).toHaveBeenCalledWith(childId);
      disableSpy.mockRestore();
    });
  });

  describe('reloadPlugin', () => {
    it('should deactivate, unload, and reactivate', async () => {
      const pluginId = 'p1';
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: { manifest: { id: pluginId } },
      } as any);
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
      vi.mocked(pluginLoader.loadPluginCode).mockResolvedValue({});

      await pluginManager.reloadPlugin(pluginId);
      expect(pluginLoader.unloadPluginCode).toHaveBeenCalledWith(
        pluginId,
        '/path'
      );
    });
  });

  describe('Additional Branch Coverage', () => {
    it('initialize should discovery and register plugins', async () => {
      vi.mocked(pluginRegistry.initialize).mockResolvedValue(undefined);
      const mockPlugins = [{ manifest: { id: 'p1' } } as any];
      vi.mocked(pluginLoader.discoverPlugins).mockResolvedValue(mockPlugins);
      vi.mocked(pluginRegistry.getEnabledPlugins).mockReturnValue([]);

      await pluginManager.initialize();

      expect(pluginLoader.registerPlugin).toHaveBeenCalledWith(mockPlugins[0]);
      expect(pluginRegistry.registerPlugin).toHaveBeenCalledWith(
        mockPlugins[0]
      );
    });

    it('initialize should not run twice', async () => {
      vi.mocked(pluginRegistry.initialize).mockResolvedValue(undefined);
      vi.mocked(pluginLoader.discoverPlugins).mockResolvedValue([]);

      await pluginManager.initialize();
      const consoleSpy = vi.spyOn(console, 'warn');
      await pluginManager.initialize();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Already initialized')
      );
      consoleSpy.mockRestore();
    });

    it('activatePlugin should throw if validation fails (missing dependencies)', async () => {
      const pluginId = 'test-plugin';
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: { manifest: { id: pluginId } },
      } as any);
      vi.mocked(dependencyResolver.validateDependencies).mockReturnValue({
        valid: false,
        missing: ['dep1'],
        incompatible: [],
        circular: [],
      });

      await expect(pluginManager.enablePlugin(pluginId)).rejects.toThrow(
        /Missing dependencies: dep1/
      );
    });

    it('activatePlugin should auto-enable disabled dependencies', async () => {
      const pluginId = 'test-plugin';
      const depId = 'dependency-plugin';
      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.getPlugin).mockImplementation((id) => {
        if (id === pluginId) {
          return {
            plugin: {
              manifest: { id: pluginId, dependencies: { [depId]: '1.0.0' } },
            },
            config: { enabled: true },
          } as any;
        }
        if (id === depId) {
          return {
            plugin: { manifest: { id: depId } },
            config: { enabled: false },
          } as any;
        }
        return undefined;
      });

      vi.mocked(dependencyResolver.validateDependencies).mockReturnValue({
        valid: true,
        missing: [],
        incompatible: [],
        circular: [],
      });
      vi.mocked(licenseManager.checkLicense).mockReturnValue({ valid: true });
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
      vi.mocked(pluginLoader.loadPluginCode).mockResolvedValue({});

      const enableSpy = vi.spyOn(pluginManager, 'enablePlugin');
      await pluginManager.enablePlugin(pluginId);

      expect(enableSpy).toHaveBeenCalledWith(depId);
      enableSpy.mockRestore();
    });

    it('uninstallPlugin should perform cascading uninstall and delete files', async () => {
      const pluginId = 'to-uninstall';
      vi.mocked(pluginRegistry.getAllPlugins).mockReturnValue([]);
      vi.mocked(dependencyResolver.getDependents).mockReturnValue([]);
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(false);
      const pluginPath = path.join('/mock/user/data', 'plugins', pluginId);
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue(pluginPath);
      vi.mocked(app.getPath).mockReturnValue('/mock/user/data');

      await pluginManager.uninstallPlugin(pluginId);

      expect(pluginRegistry.unregisterPlugin).toHaveBeenCalledWith(pluginId);
      expect(pluginLoader.unregisterPlugin).toHaveBeenCalledWith(pluginId);
      expect(fs.promises.rm).toHaveBeenCalled();
    });

    it('uninstallPlugin should skip file deletion for bundled plugins', async () => {
      const pluginId = 'bundled-plugin';
      vi.mocked(pluginRegistry.getAllPlugins).mockReturnValue([]);
      vi.mocked(dependencyResolver.getDependents).mockReturnValue([]);
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(false);
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue(
        '/app/bundled/plugin'
      );
      vi.mocked(app.getPath).mockReturnValue('/mock/user/data');

      await pluginManager.uninstallPlugin(pluginId);

      expect(fs.promises.rm).not.toHaveBeenCalled();
    });

    it('importPlugin should validate and copy files', async () => {
      const source = '/src/plugin';
      vi.mocked(fs.promises.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify({ id: 'imported' })
      );
      vi.mocked(fs.promises.access).mockRejectedValue(new Error('not found'));

      const result = await pluginManager.importPlugin(source);

      expect(result).toBe('imported');
      expect(fs.promises.cp).toHaveBeenCalled();
    });

    it('importPlugin should throw if source is not a directory', async () => {
      vi.mocked(fs.promises.stat).mockResolvedValue({
        isDirectory: () => false,
      } as any);
      await expect(pluginManager.importPlugin('/src/file')).rejects.toThrow(
        'Source path must be a directory'
      );
    });

    it('importPlugin should throw if plugin already exists', async () => {
      vi.mocked(fs.promises.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify({ id: 'exists' })
      );
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);
      await expect(pluginManager.importPlugin('/src/plugin')).rejects.toThrow(
        'already exists'
      );
    });

    it('refreshDiscovery should register plugin if found', async () => {
      const pluginId = 'refresh-me';
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
      const mockPlugin = { manifest: { id: pluginId } } as any;
      vi.mocked(pluginLoader.loadPluginFromDirectory).mockResolvedValue(
        mockPlugin
      );

      await pluginManager.refreshDiscovery(pluginId);

      expect(pluginLoader.registerPlugin).toHaveBeenCalledWith(mockPlugin);
      expect(pluginRegistry.registerPlugin).toHaveBeenCalledWith(mockPlugin);
    });

    it('getPluginSettings / updatePluginSettings should delegate to registry', async () => {
      const pluginId = 'p';
      const mockPlugin = { manifest: { id: pluginId } };
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: mockPlugin,
      } as any);
      vi.mocked(pluginRegistry.getPluginSettings).mockReturnValue({
        key: 'val',
      });

      expect(pluginManager.getPluginSettings(pluginId)).toEqual({ key: 'val' });
      expect(pluginManager.getPlugin(pluginId)).toEqual(mockPlugin);

      await pluginManager.updatePluginSettings(pluginId, { new: 'val' });
      expect(pluginRegistry.updatePluginSettings).toHaveBeenCalledWith(
        pluginId,
        { new: 'val' }
      );
    });
  });
});
