// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalPluginModule } from '../services/plugins/host/module-handle';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/mock'),
    getAppPath: vi.fn(() => '/mock'),
  },
}));

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mocks = vi.hoisted(() => ({
  registry: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getAllPlugins: vi.fn().mockReturnValue([]),
    getEnabledPlugins: vi.fn().mockReturnValue([]),
    hasPlugin: vi.fn().mockReturnValue(false),
    getPlugin: vi.fn().mockReturnValue(undefined),
    registerPlugin: vi.fn().mockResolvedValue(undefined),
    enablePlugin: vi.fn().mockResolvedValue(undefined),
    disablePlugin: vi.fn().mockResolvedValue(undefined),
    setPluginContext: vi.fn(),
    clearPluginContext: vi.fn(),
    getPluginContext: vi.fn().mockReturnValue(undefined),
    updatePluginConfig: vi.fn().mockResolvedValue(undefined),
  },
  loader: {
    discoverPlugins: vi.fn().mockResolvedValue([]),
    registerPlugin: vi.fn(),
    getPluginPath: vi.fn().mockResolvedValue('/mock/plugin'),
    loadPluginCode: vi.fn().mockResolvedValue({}),
    unloadPluginCode: vi.fn().mockResolvedValue(undefined),
    acquireModuleHandle: vi.fn(),
    releaseModuleHandle: vi.fn(),
    updatePluginState: vi.fn(),
  },
  license: {
    checkLicense: vi.fn().mockReturnValue({ valid: true }),
  },
  depResolver: {
    validateDependencies: vi.fn().mockReturnValue({
      valid: true,
      missing: [],
      incompatible: [],
      circular: [],
    }),
    getDependents: vi.fn().mockReturnValue([]),
  },
  storage: {
    migrateFromJson: vi.fn().mockResolvedValue(undefined),
  },
  dataLoader: {
    loadPluginData: vi.fn().mockResolvedValue([]),
    applyDataToStorage: vi.fn().mockResolvedValue(undefined),
  },
  eventBus: {
    emitPluginActivated: vi.fn(),
    emitPluginDeactivated: vi.fn(),
    getMainWindow: vi.fn().mockReturnValue(null),
    emit: vi.fn(),
    on: vi.fn(),
  },
  watcher: {
    watch: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  },
  marketplace: {
    checkForUpdates: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  pathService: {
    getPluginsDir: vi.fn().mockReturnValue('/mock/plugins'),
  },
}));

vi.mock('../services/plugins/plugin-registry', () => ({
  pluginRegistry: mocks.registry,
}));
vi.mock('../services/plugins/plugin-loader', () => ({
  pluginLoader: mocks.loader,
}));
vi.mock('../services/security/license-manager', () => ({
  licenseManager: mocks.license,
}));
vi.mock('../services/plugins/dependency-resolver', () => ({
  dependencyResolver: mocks.depResolver,
}));
vi.mock('../services/plugins/storage-service', () => ({
  storageService: mocks.storage,
}));
vi.mock('../services/plugins/data-loader', () => ({
  dataLoader: mocks.dataLoader,
}));
vi.mock('../services/plugins/plugin-events', () => ({
  pluginEventBus: mocks.eventBus,
}));
vi.mock('../services/plugins/plugin-watcher', () => ({
  pluginWatcher: mocks.watcher,
}));
vi.mock('../services/marketplace/marketplace-service', () => ({
  marketplaceService: mocks.marketplace,
}));
vi.mock('../services/plugins/path-service', () => ({
  pathService: mocks.pathService,
}));
vi.mock('../services/plugins/plugin-extensions', () => ({
  getAllPluginExtensions: vi.fn().mockReturnValue([]),
  clearPluginExtensions: vi.fn(),
  getPluginExtensions: vi.fn().mockReturnValue({}),
  savePluginExtensions: vi.fn(),
}));
vi.mock('../services/plugins/plugin-context', () => ({
  createPluginContext: vi.fn().mockReturnValue({
    pluginId: 'test-plugin',
    pluginPath: '/mock/plugin',
    kubernetes: {},
    ui: {},
    storage: {},
    logger: {},
    events: {},
  }),
}));
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn().mockReturnValue([]),
  },
}));

import { PluginManager } from '../services/plugins/plugin-manager';

function makePluginEntry(id: string, enabled = true) {
  return {
    plugin: {
      manifest: {
        id,
        name: `Plugin ${id}`,
        version: '1.0.0',
        permissions: [],
        license: { type: 'free' },
      },
      hasUpdate: false,
      latestVersion: undefined as string | undefined,
    },
    config: { enabled },
  };
}

describe('PluginManager', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager();
    vi.clearAllMocks();

    mocks.registry.initialize.mockResolvedValue(undefined);
    mocks.registry.getAllPlugins.mockReturnValue([]);
    mocks.registry.getEnabledPlugins.mockReturnValue([]);
    mocks.registry.hasPlugin.mockReturnValue(false);
    mocks.registry.getPlugin.mockReturnValue(undefined);
    mocks.loader.discoverPlugins.mockResolvedValue([]);
    mocks.depResolver.validateDependencies.mockReturnValue({
      valid: true,
      missing: [],
      incompatible: [],
      circular: [],
    });
    mocks.depResolver.getDependents.mockReturnValue([]);
    mocks.license.checkLicense.mockReturnValue({ valid: true });
    mocks.loader.loadPluginCode.mockResolvedValue({});
    // Route module handles through loadPluginCode so per-test module mocks
    // keep driving the hooks exactly as before the handle abstraction.
    mocks.loader.acquireModuleHandle.mockImplementation(
      async (pluginId: string, pluginPath: string) =>
        new LocalPluginModule(
          await mocks.loader.loadPluginCode(pluginId, pluginPath)
        )
    );
    mocks.loader.getPluginPath.mockResolvedValue('/mock/plugin');
  });

  describe('initialize', () => {
    it('initializes registry and discovers plugins', async () => {
      await manager.initialize();

      expect(mocks.registry.initialize).toHaveBeenCalled();
      expect(mocks.loader.discoverPlugins).toHaveBeenCalled();
    });

    it('is idempotent — second call is no-op', async () => {
      await manager.initialize();
      await manager.initialize();

      expect(mocks.registry.initialize).toHaveBeenCalledTimes(1);
    });

    it('auto-enables previously enabled plugins on init', async () => {
      const entry = makePluginEntry('auto-plugin');
      mocks.registry.getEnabledPlugins.mockReturnValue([entry.plugin]);
      mocks.registry.getPlugin.mockReturnValue(entry);
      mocks.registry.hasPlugin.mockReturnValue(true);
      mocks.registry.getAllPlugins.mockReturnValue([entry.plugin]);

      await manager.initialize();

      // activatePlugin is called for each previously-enabled plugin
      expect(mocks.loader.updatePluginState).toHaveBeenCalledWith(
        'auto-plugin',
        'enabled'
      );
    });
  });

  describe('enablePlugin', () => {
    it('throws if plugin not found', async () => {
      mocks.registry.hasPlugin.mockReturnValue(false);

      await expect(manager.enablePlugin('nonexistent')).rejects.toThrow(
        'Plugin nonexistent not found'
      );
    });

    it('enables a plugin successfully', async () => {
      const entry = makePluginEntry('test-plugin');
      mocks.registry.hasPlugin.mockReturnValue(true);
      mocks.registry.getPlugin.mockReturnValue(entry);
      mocks.registry.getAllPlugins.mockReturnValue([entry.plugin]);

      await manager.enablePlugin('test-plugin');

      expect(mocks.registry.enablePlugin).toHaveBeenCalledWith('test-plugin');
      expect(mocks.loader.updatePluginState).toHaveBeenCalledWith(
        'test-plugin',
        'enabled'
      );
    });

    it('returns list of auto-enabled dependencies', async () => {
      const dep = makePluginEntry('dep-plugin', false);
      const main = {
        plugin: {
          ...makePluginEntry('main-plugin').plugin,
          manifest: {
            ...makePluginEntry('main-plugin').plugin.manifest,
            dependencies: { 'dep-plugin': '^1.0.0' },
          },
        },
        config: { enabled: true },
      };

      mocks.registry.hasPlugin.mockReturnValue(true);
      mocks.registry.getPlugin.mockImplementation((id: string) => {
        if (id === 'main-plugin') return main;
        if (id === 'dep-plugin') return dep;
        return undefined;
      });
      mocks.registry.getAllPlugins.mockReturnValue([main.plugin, dep.plugin]);

      const autoDeps = await manager.enablePlugin('main-plugin');

      expect(Array.isArray(autoDeps)).toBe(true);
    });
  });

  describe('disablePlugin', () => {
    it('throws if plugin not found', async () => {
      mocks.registry.hasPlugin.mockReturnValue(false);

      await expect(manager.disablePlugin('nonexistent')).rejects.toThrow(
        'Plugin nonexistent not found'
      );
    });

    it('disables plugin and returns empty cascaded list when no dependents', async () => {
      const entry = makePluginEntry('test-plugin');
      mocks.registry.hasPlugin.mockReturnValue(true);
      mocks.registry.getPlugin.mockReturnValue(entry);
      mocks.registry.getEnabledPlugins.mockReturnValue([entry.plugin]);
      mocks.depResolver.getDependents.mockReturnValue([]);
      mocks.loader.loadPluginCode.mockResolvedValue({});

      const cascaded = await manager.disablePlugin('test-plugin');

      expect(cascaded).toHaveLength(0);
      expect(mocks.registry.disablePlugin).toHaveBeenCalledWith('test-plugin');
    });

    it('cascades disable to dependents', async () => {
      const dep = makePluginEntry('dependent-plugin');
      const main = makePluginEntry('main-plugin');

      mocks.registry.hasPlugin.mockReturnValue(true);
      mocks.registry.getPlugin.mockImplementation((id: string) =>
        id === 'main-plugin' ? main : dep
      );
      mocks.registry.getEnabledPlugins.mockReturnValue([
        main.plugin,
        dep.plugin,
      ]);
      mocks.depResolver.getDependents
        .mockReturnValueOnce([dep.plugin])
        .mockReturnValueOnce([]);

      mocks.loader.loadPluginCode.mockResolvedValue({});

      const cascaded = await manager.disablePlugin('main-plugin');

      expect(cascaded).toContain('dependent-plugin');
    });
  });

  describe('checkForUpdates', () => {
    beforeEach(() => {
      vi.stubEnv('MARKETPLACE_ENABLED', 'true');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('does nothing while the marketplace is disabled', async () => {
      vi.stubEnv('MARKETPLACE_ENABLED', '');

      await manager.checkForUpdates();

      expect(mocks.marketplace.checkForUpdates).not.toHaveBeenCalled();
    });

    it('returns early with no plugins installed', async () => {
      mocks.registry.getAllPlugins.mockReturnValue([]);

      await manager.checkForUpdates();

      expect(mocks.marketplace.checkForUpdates).toHaveBeenCalledWith([]);
    });

    it('marks plugins with updates', async () => {
      const plugin = makePluginEntry('test-plugin').plugin;
      mocks.registry.getAllPlugins.mockReturnValue([plugin]);
      mocks.marketplace.checkForUpdates.mockResolvedValue({
        success: true,
        data: [
          { pluginId: 'test-plugin', hasUpdate: true, latestVersion: '2.0.0' },
        ],
      });
      mocks.registry.getPlugin.mockReturnValue({ plugin });

      await manager.checkForUpdates();

      expect(plugin.hasUpdate).toBe(true);
      expect(plugin.latestVersion).toBe('2.0.0');
    });
  });

  describe('getPlugins / getPlugin', () => {
    it('returns all plugins from registry', () => {
      const p1 = makePluginEntry('plugin-1').plugin;
      const p2 = makePluginEntry('plugin-2').plugin;
      mocks.registry.getAllPlugins.mockReturnValue([p1, p2]);

      const plugins = manager.getPlugins();
      expect(plugins).toHaveLength(2);
    });

    it('returns undefined for unknown plugin', () => {
      mocks.registry.getPlugin.mockReturnValue(undefined);
      expect(manager.getPlugin('unknown')).toBeUndefined();
    });
  });
});
