import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PluginManager,
  STARTUP_ACTIVATION_WAIT_MS,
  settledWithin,
} from '../services/plugins/plugin-manager';
import { pluginLoader } from '../services/plugins/plugin-loader';
import { pluginRegistry } from '../services/plugins/plugin-registry';
import { licenseManager } from '../services/security/license-manager';
import { pluginWatcher } from '../services/plugins/plugin-watcher';
import { storageService } from '../services/plugins/storage-service';

vi.mock('../logger', () => ({
  default: {
    error: (...args: unknown[]) => console.error(...args),
    warn: (...args: unknown[]) => console.warn(...args),
    info: (...args: unknown[]) => console.log(...args),
    debug: (...args: unknown[]) => console.debug(...args),
    verbose: (...args: unknown[]) => console.log(...args),
  },
}));
import { app } from 'electron';
import { pathService } from '../services/plugins/path-service';
import { signatureService } from '../services/security/signature-service';
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
    acquireModuleHandle: vi.fn(),
    releaseModuleHandle: vi.fn(),
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
    getPluginConfig: vi.fn(async () => null),
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
}));

vi.mock('../services/plugins/plugin-extensions', () => ({
  getAllPluginExtensions: vi.fn(),
  clearPluginExtensions: vi.fn(),
}));

vi.mock('../services/plugins/plugin-watcher', () => ({
  pluginWatcher: {
    watch: vi.fn(),
    stop: vi.fn(),
    stopAll: vi.fn(),
  },
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

vi.mock('../services/security/signature-service', () => ({
  signatureService: {
    checkPlugin: vi.fn().mockResolvedValue({ ok: true }),
  },
  describeSignatureProblem: (problem: string) => `refused: ${problem}`,
}));

vi.mock('../services/plugins/path-service', () => ({
  pathService: {
    getUserPluginsDir: vi.fn().mockReturnValue('/mock/user/plugins'),
    getDiscoveryDirectories: vi
      .fn()
      .mockReturnValue(['/mock/app/plugins', '/mock/user/plugins']),
    resolvePluginPath: vi.fn(),
    isBundledPluginId: vi.fn().mockResolvedValue(false),
    getPluginStorageDir: vi
      .fn()
      .mockImplementation(
        (id: string) => `/mock/user/data/plugin-storage/${id}`
      ),
  },
}));

vi.mock('../services/plugins/storage-service', () => ({
  storageService: {
    migrateFromJson: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('../services/plugins/plugin-events', () => ({
  pluginEventBus: {
    emitPluginActivated: vi.fn(),
    emitPluginDeactivated: vi.fn(),
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
import { LocalPluginModule } from '../services/plugins/host/module-handle';
import { createPluginContext } from '../services/plugins/plugin-context';
import { getAllPluginExtensions } from '../services/plugins/plugin-extensions';
import { dependencyResolver } from '../services/plugins/dependency-resolver';
import { dataLoader } from '../services/plugins/data-loader';
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
    // Route module handles through loadPluginCode so per-test module mocks
    // keep driving the hooks exactly as before the handle abstraction.
    vi.mocked(pluginLoader.acquireModuleHandle).mockImplementation(
      async (pluginId: string, pluginPath: string) =>
        new LocalPluginModule(
          await pluginLoader.loadPluginCode(pluginId, pluginPath)
        )
    );
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
    beforeEach(() => {
      vi.stubEnv('MARKETPLACE_ENABLED', 'true');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('should not contact the marketplace when it is disabled', async () => {
      vi.stubEnv('MARKETPLACE_ENABLED', '');

      await pluginManager.checkForUpdates();

      expect(marketplaceService.checkForUpdates).not.toHaveBeenCalled();
    });

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

    it('refuses lifecycle hooks as actions', async () => {
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({} as any);
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(true);
      await expect(
        pluginManager.executePluginAction('p1', 'activate')
      ).rejects.toThrow(/lifecycle hook/);
      expect(pluginLoader.acquireModuleHandle).not.toHaveBeenCalled();
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
        new Map([['p1', extensions as any]])
      );
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(true);

      const results = pluginManager.getPluginExtensions('sidebar');
      expect(results).toHaveLength(1);
      expect((results[0] as any).id).toBe('s1');
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
        mockPlugins[0],
        undefined
      );
    });

    it('initialize should enable a bundled example plugin on first run', async () => {
      vi.mocked(pluginRegistry.initialize).mockResolvedValue(undefined);
      const bundled = {
        manifest: { id: 'resource-monitor' },
        state: 'disabled',
      } as any;
      vi.mocked(pluginLoader.discoverPlugins).mockResolvedValue([bundled]);
      vi.mocked(pluginRegistry.getPluginConfig).mockResolvedValue(null);

      await pluginManager.initialize();

      expect(pluginRegistry.registerPlugin).toHaveBeenCalledWith(bundled, {
        enabled: true,
        settings: {},
      });
    });

    it('initialize should keep the saved config of a bundled plugin', async () => {
      vi.mocked(pluginRegistry.initialize).mockResolvedValue(undefined);
      const bundled = {
        manifest: { id: 'namespace-watcher' },
        state: 'disabled',
      } as any;
      vi.mocked(pluginLoader.discoverPlugins).mockResolvedValue([bundled]);
      vi.mocked(pluginRegistry.getPluginConfig).mockResolvedValue({
        enabled: false,
        settings: {},
      });

      await pluginManager.initialize();

      expect(pluginRegistry.registerPlugin).toHaveBeenCalledWith(
        bundled,
        undefined
      );
    });

    it('initialize should not enable a bundled plugin that failed to load', async () => {
      vi.mocked(pluginRegistry.initialize).mockResolvedValue(undefined);
      const broken = {
        manifest: { id: 'resource-monitor' },
        state: 'error',
      } as any;
      vi.mocked(pluginLoader.discoverPlugins).mockResolvedValue([broken]);

      await pluginManager.initialize();

      expect(pluginRegistry.getPluginConfig).not.toHaveBeenCalled();
      expect(pluginRegistry.registerPlugin).toHaveBeenCalledWith(
        broken,
        undefined
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

    it('initialize should auto-enable previously enabled plugins', async () => {
      vi.mocked(pluginRegistry.initialize).mockResolvedValue(undefined);
      const mockPlugins = [{ manifest: { id: 'p1' } } as any];
      vi.mocked(pluginLoader.discoverPlugins).mockResolvedValue(mockPlugins);
      vi.mocked(pluginRegistry.getEnabledPlugins).mockReturnValue([
        { manifest: { id: 'p1' }, config: { enabled: true } } as any,
      ]);

      const activateSpy = vi
        .spyOn(pluginManager as any, 'activatePlugin')
        .mockResolvedValue(undefined);

      await pluginManager.initialize();

      expect(activateSpy).toHaveBeenCalledWith('p1');
      activateSpy.mockRestore();
    });

    it('initialize should handle errors during auto-enable', async () => {
      vi.mocked(pluginRegistry.initialize).mockResolvedValue(undefined);
      vi.mocked(pluginLoader.discoverPlugins).mockResolvedValue([]);
      vi.mocked(pluginRegistry.getEnabledPlugins).mockReturnValue([
        { manifest: { id: 'p1' }, config: { enabled: true } } as any,
      ]);

      const activateSpy = vi
        .spyOn(pluginManager as any, 'activatePlugin')
        .mockRejectedValue(new Error('Fail'));
      const consoleSpy = vi.spyOn(console, 'error');

      await pluginManager.initialize();

      expect(activateSpy).toHaveBeenCalledWith('p1');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to auto-enable'),
        'Fail'
      );
      activateSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('initialize should propagate initialization errors', async () => {
      vi.mocked(pluginRegistry.initialize).mockRejectedValue(
        new Error('Init fail')
      );
      const consoleSpy = vi.spyOn(console, 'error');
      await expect(pluginManager.initialize()).rejects.toThrow('Init fail');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize'),
        'Init fail'
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
      const pluginsDir = path.resolve('/mock/user/plugins');
      const pluginPath = path.join(pluginsDir, pluginId);
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue(pluginPath);
      vi.mocked(pathService.getUserPluginsDir).mockReturnValue(pluginsDir);

      await pluginManager.uninstallPlugin(pluginId);

      expect(pluginRegistry.unregisterPlugin).toHaveBeenCalledWith(pluginId);
      expect(pluginLoader.unregisterPlugin).toHaveBeenCalledWith(pluginId);
      expect(fs.promises.rm).toHaveBeenCalledWith(pluginPath, {
        recursive: true,
        force: true,
      });
      expect(storageService.clear).toHaveBeenCalledWith(pluginId);
      expect(fs.promises.rm).toHaveBeenCalledWith(
        `/mock/user/data/plugin-storage/${pluginId}`,
        { recursive: true, force: true }
      );
    });

    it('uninstallPlugin should refuse a bundled plugin', async () => {
      const pluginId = 'bundled-plugin';
      vi.mocked(pathService.isBundledPluginId).mockResolvedValueOnce(true);

      await expect(pluginManager.uninstallPlugin(pluginId)).rejects.toThrow(
        /bundled with Shoal/
      );

      expect(pluginRegistry.unregisterPlugin).not.toHaveBeenCalled();
      expect(fs.promises.rm).not.toHaveBeenCalled();
    });

    it('uninstallPlugin should skip file deletion for a plugin outside the user directory', async () => {
      const pluginId = 'elsewhere-plugin';
      vi.mocked(pluginRegistry.getAllPlugins).mockReturnValue([]);
      vi.mocked(dependencyResolver.getDependents).mockReturnValue([]);
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(false);
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue(
        path.resolve('/app/bundled/plugin')
      );
      vi.mocked(pathService.getUserPluginsDir).mockReturnValue(
        path.resolve('/mock/user/plugins')
      );

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

    it('importPlugin should refuse the id of a bundled plugin', async () => {
      vi.mocked(fs.promises.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify({ id: 'resource-monitor' })
      );
      vi.mocked(pathService.isBundledPluginId).mockResolvedValueOnce(true);

      await expect(pluginManager.importPlugin('/src/plugin')).rejects.toThrow(
        'belongs to a plugin bundled with Shoal'
      );
      expect(fs.promises.cp).not.toHaveBeenCalled();
    });

    it('importPlugin should refuse an unsigned plugin before copying it', async () => {
      vi.mocked(fs.promises.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify({ id: 'unsigned' })
      );
      vi.mocked(signatureService.checkPlugin).mockResolvedValueOnce({
        ok: false,
        problem: 'no signature file',
      });

      await expect(pluginManager.importPlugin('/src/plugin')).rejects.toThrow(
        'refused: no signature file'
      );
      expect(fs.promises.cp).not.toHaveBeenCalled();
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

  describe('Watcher', () => {
    it('watchPlugin should call pluginWatcher.watch', async () => {
      const pluginId = 'p1';
      await pluginManager.watchPlugin(pluginId);
      expect(pluginWatcher.watch).toHaveBeenCalledWith(
        pluginId,
        expect.any(Function)
      );
    });

    it('stopWatcher should call pluginWatcher.stop', () => {
      const pluginId = 'p1';
      (pluginManager as any).stopWatcher(pluginId);
      expect(pluginWatcher.stop).toHaveBeenCalledWith(pluginId);
    });
  });

  describe('Updated Activation Logic', () => {
    it('activatePlugin should report detailed dependency errors', async () => {
      const pluginId = 'p1';
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: { manifest: { id: pluginId } },
      } as any);
      vi.mocked(dependencyResolver.validateDependencies).mockReturnValue({
        valid: false,
        missing: ['m1'],
        incompatible: [{ pluginId: 'i1', required: '1.0', installed: '0.9' }],
        circular: [['c1', 'c2']],
      });

      // All errors are combined in one error message
      const error = await pluginManager.enablePlugin(pluginId).catch((e) => e);
      expect(error.message).toContain('Missing dependencies: m1');
      expect(error.message).toContain('requires 1.0, but 0.9 is installed');
      expect(error.message).toContain(
        'Circular dependencies detected: c1 -> c2'
      );
    });

    it('activatePlugin should load and apply plugin data', async () => {
      const pluginId = 'p1';
      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: { manifest: { id: pluginId } },
        config: { enabled: true },
      } as any);
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
      vi.mocked(pluginLoader.loadPluginCode).mockResolvedValue({});

      // Mock createPluginContext to return a context with storage
      const mockContext = { storage: {} };
      vi.mocked(createPluginContext).mockReturnValue(mockContext as any);

      const mockData = [{ kind: 'Dashboard', metadata: { name: 'Dash' } }];
      vi.mocked(dataLoader.loadPluginData).mockResolvedValue(mockData as any);

      await pluginManager.enablePlugin(pluginId);

      expect(dataLoader.applyDataToStorage).toHaveBeenCalled();
    });

    it('activatePlugin should fail if data loading fails', async () => {
      const pluginId = 'p1';
      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: { manifest: { id: pluginId } },
        config: { enabled: true },
      } as any);
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
      vi.mocked(dataLoader.loadPluginData).mockRejectedValue(
        new Error('Data fail')
      );

      const consoleSpy = vi.spyOn(console, 'error');
      await expect(pluginManager.enablePlugin(pluginId)).rejects.toThrow(
        'Data fail'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load data'),
        'Data fail'
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Deactivation Edge Cases', () => {
    it('deactivatePlugin should return early if plugin not found', async () => {
      const pluginId = 'p1';
      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(true);
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        manifest: { id: pluginId },
      } as any);

      // Mock getPluginPath to return null to trigger early return in deactivatePlugin
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue(null);

      await pluginManager.disablePlugin(pluginId);

      // Should still call getPluginPath but not proceed to clearPluginContext
      expect(pluginLoader.getPluginPath).toHaveBeenCalledWith(pluginId);
      expect(pluginRegistry.clearPluginContext).not.toHaveBeenCalled();
    });

    it('deactivatePlugin should return early if path not found', async () => {
      const pluginId = 'p1';
      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(true);
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        manifest: { id: pluginId },
      } as any);
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue(null);

      await pluginManager.disablePlugin(pluginId);
      expect(pluginRegistry.clearPluginContext).not.toHaveBeenCalled();
    });

    it('deactivatePlugin should handle errors during hook execution', async () => {
      const pluginId = 'p1';
      vi.mocked(pluginRegistry.hasPlugin).mockReturnValue(true);
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(true);
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        manifest: { id: pluginId },
      } as any);
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');

      vi.mocked(pluginLoader.loadPluginCode).mockRejectedValue(
        new Error('Hook fail')
      );
      const consoleSpy = vi.spyOn(console, 'warn');

      await pluginManager.disablePlugin(pluginId);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not execute deactivation hooks'),
        expect.any(Error)
      );
      // Should still proceed to unload
      expect(pluginLoader.unloadPluginCode).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Uninstall Edge Cases', () => {
    it('uninstallPlugin should perform REAL cascading uninstall', async () => {
      const parentId = 'parent';
      const childId = 'child';
      vi.mocked(pluginRegistry.getAllPlugins).mockReturnValue([
        { manifest: { id: parentId } } as any,
        { manifest: { id: childId } } as any,
      ]);

      // Mock getDependents to return child when asked for parent
      vi.mocked(dependencyResolver.getDependents).mockImplementation((id) => {
        if (id === parentId) return [{ manifest: { id: childId } } as any];
        return [];
      });

      const uninstallSpy = vi.spyOn(pluginManager, 'uninstallPlugin');
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');

      await pluginManager.uninstallPlugin(parentId);

      expect(uninstallSpy).toHaveBeenCalledWith(childId);
      uninstallSpy.mockRestore();
    });

    it('uninstallPlugin should disable plugin first if enabled', async () => {
      const pluginId = 'p1';
      vi.mocked(pluginRegistry.getAllPlugins).mockReturnValue([]);
      vi.mocked(dependencyResolver.getDependents).mockReturnValue([]);
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(true);
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');

      const disableSpy = vi
        .spyOn(pluginManager, 'disablePlugin')
        .mockResolvedValue([]);

      await pluginManager.uninstallPlugin(pluginId);

      expect(disableSpy).toHaveBeenCalledWith(pluginId);
      disableSpy.mockRestore();
    });

    it('uninstallPlugin should handle file deletion errors', async () => {
      const pluginId = 'p1';
      vi.mocked(pluginRegistry.getAllPlugins).mockReturnValue([]);
      vi.mocked(dependencyResolver.getDependents).mockReturnValue([]);
      vi.mocked(pluginRegistry.isPluginEnabled).mockReturnValue(false);

      // Make sure the path matches the pattern: pluginsDir/pluginId
      const pluginsDir = path.resolve('/mock/user/plugins');
      const pluginPath = path.join(pluginsDir, pluginId);
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue(pluginPath);
      vi.mocked(pathService.getUserPluginsDir).mockReturnValue(pluginsDir);

      vi.mocked(fs.promises.rm).mockRejectedValue(new Error('Delete fail'));
      const consoleSpy = vi.spyOn(console, 'error');

      await pluginManager.uninstallPlugin(pluginId);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete files'),
        'Delete fail'
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Refresh Discovery Edge Cases', () => {
    it('refreshDiscovery should handle missing plugin path', async () => {
      const pluginId = 'p1';
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue(null);
      const warnSpy = vi.spyOn(console, 'warn');

      await pluginManager.refreshDiscovery(pluginId);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not find path')
      );
      warnSpy.mockRestore();
    });

    it('refreshDiscovery should handle load failure', async () => {
      const pluginId = 'p1';
      vi.mocked(pluginLoader.getPluginPath).mockResolvedValue('/path');
      vi.mocked(pluginLoader.loadPluginFromDirectory).mockResolvedValue(null);
      const warnSpy = vi.spyOn(console, 'warn');

      await pluginManager.refreshDiscovery(pluginId);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not load plugin')
      );
      warnSpy.mockRestore();
    });
  });
});

describe('start-up activation budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('settledWithin reports whether a promise settles in time', async () => {
    expect(await settledWithin(Promise.resolve(1), 10)).toBe(true);
    expect(await settledWithin(Promise.reject(new Error('x')), 10)).toBe(true);
    const pending = settledWithin(new Promise(() => {}), 50);
    await vi.advanceTimersByTimeAsync(60);
    expect(await pending).toBe(false);
  });

  it('initialize moves on when a plugin keeps activating', async () => {
    const manager = new PluginManager();
    vi.mocked(pluginRegistry.initialize).mockResolvedValue(undefined);
    vi.mocked(pluginLoader.discoverPlugins).mockResolvedValue([]);
    vi.mocked(pluginRegistry.getEnabledPlugins).mockReturnValue([
      { manifest: { id: 'slow' }, config: { enabled: true } } as any,
      { manifest: { id: 'fast' }, config: { enabled: true } } as any,
    ]);
    const activateSpy = vi
      .spyOn(manager as any, 'activatePlugin')
      .mockImplementation(async (id: unknown) => {
        if (id === 'slow') await new Promise(() => {});
      });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const init = manager.initialize();
    await vi.advanceTimersByTimeAsync(STARTUP_ACTIVATION_WAIT_MS + 1);
    await init;

    expect(activateSpy).toHaveBeenCalledWith('slow');
    expect(activateSpy).toHaveBeenCalledWith('fast');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('slow is still activating')
    );
    warn.mockRestore();
  });
});
