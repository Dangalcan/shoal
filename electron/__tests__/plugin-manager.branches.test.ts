/**
 * PluginManager branches the other suites leave out: a Disable that lands
 * while the activation settles, lookups that find nothing (plugin, path,
 * dependency, extension point), dependency error messages without missing
 * plugins, and the watcher's reload callback.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  Plugin,
  PluginConfig,
  PluginContext,
  PluginRegistryEntry,
  PluginState,
} from '../types/plugin-types';

const mocks = vi.hoisted(() => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  registry: {
    initialize: vi.fn(),
    getPlugin: vi.fn(),
    getAllPlugins: vi.fn(),
    getEnabledPlugins: vi.fn(),
    registerPlugin: vi.fn(),
    getPluginConfig: vi.fn(),
    unregisterPlugin: vi.fn(),
    enablePlugin: vi.fn(),
    disablePlugin: vi.fn(),
    hasPlugin: vi.fn(),
    isPluginEnabled: vi.fn(),
    setPluginContext: vi.fn(),
    getPluginContext: vi.fn(),
    clearPluginContext: vi.fn(),
  },
  loader: {
    getPluginPath: vi.fn(),
    unloadPluginCode: vi.fn(),
    acquireModuleHandle: vi.fn(),
    releaseModuleHandle: vi.fn(),
    registerPlugin: vi.fn(),
    unregisterPlugin: vi.fn(),
    updatePluginState: vi.fn(),
    discoverPlugins: vi.fn(),
    loadPluginFromDirectory: vi.fn(),
  },
  license: { checkLicense: vi.fn() },
  marketplace: { checkForUpdates: vi.fn() },
  createPluginContext: vi.fn(),
  extensions: {
    getAllPluginExtensions: vi.fn(),
    clearPluginExtensions: vi.fn(),
  },
  watcher: { watch: vi.fn(), stop: vi.fn() },
  depResolver: { validateDependencies: vi.fn(), getDependents: vi.fn() },
  dataLoader: { loadPluginData: vi.fn(), applyDataToStorage: vi.fn() },
  storage: { migrateFromJson: vi.fn(), clear: vi.fn() },
  eventBus: { emitPluginActivated: vi.fn(), emitPluginDeactivated: vi.fn() },
  pathService: {
    getUserPluginsDir: vi.fn(),
    isBundledPluginId: vi.fn(),
    getPluginStorageDir: vi.fn(),
  },
  signature: { checkPlugin: vi.fn() },
  fsPromises: {
    stat: vi.fn(),
    readFile: vi.fn(),
    access: vi.fn(),
    cp: vi.fn(),
    rm: vi.fn(),
  },
}));

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: vi.fn(() => '/mock/user/data') },
}));
vi.mock('../logger', () => ({ default: mocks.log }));
vi.mock('../services/plugins/plugin-registry', () => ({
  pluginRegistry: mocks.registry,
}));
vi.mock('../services/plugins/plugin-loader', () => ({
  pluginLoader: mocks.loader,
}));
vi.mock('../services/security/license-manager', () => ({
  licenseManager: mocks.license,
}));
vi.mock('../services/marketplace/marketplace-service', () => ({
  marketplaceService: mocks.marketplace,
}));
vi.mock('../services/plugins/plugin-context', () => ({
  createPluginContext: mocks.createPluginContext,
}));
vi.mock('../services/plugins/plugin-extensions', () => mocks.extensions);
vi.mock('../services/plugins/plugin-watcher', () => ({
  pluginWatcher: mocks.watcher,
}));
vi.mock('../services/plugins/dependency-resolver', () => ({
  dependencyResolver: mocks.depResolver,
}));
vi.mock('../services/plugins/data-loader', () => ({
  dataLoader: mocks.dataLoader,
}));
vi.mock('../services/plugins/storage-service', () => ({
  storageService: mocks.storage,
}));
vi.mock('../services/plugins/plugin-events', () => ({
  pluginEventBus: mocks.eventBus,
}));
vi.mock('../services/plugins/path-service', () => ({
  pathService: mocks.pathService,
}));
vi.mock('../services/security/signature-service', () => ({
  signatureService: mocks.signature,
  describeSignatureProblem: (problem: string) => `refused: ${problem}`,
}));
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: { ...actual, promises: mocks.fsPromises },
    promises: mocks.fsPromises,
  };
});

import { PluginManager } from '../services/plugins/plugin-manager';
import { LocalPluginModule } from '../services/plugins/host/module-handle';

const CONTEXT = { pluginId: 'p1' } as unknown as PluginContext;

function makeEntry(
  id: string,
  options: {
    state?: PluginState;
    enabled?: boolean;
    dependencies?: Record<string, string>;
  } = {}
): PluginRegistryEntry {
  return {
    plugin: {
      manifest: {
        id,
        name: id,
        version: '1.0.0',
        description: '',
        author: '',
        permissions: [],
        license: { type: 'free', spdx: 'MIT' },
        ...(options.dependencies ? { dependencies: options.dependencies } : {}),
      },
      state: options.state ?? 'disabled',
      installedAt: '2026-01-01T00:00:00.000Z',
    } as Plugin,
    config: { enabled: options.enabled ?? true } as PluginConfig,
  };
}

/** Registry and loader mocks that keep their state in `entries`. */
function seedRegistry(...entries: PluginRegistryEntry[]): void {
  const byId = new Map(entries.map((e) => [e.plugin.manifest.id, e]));
  mocks.registry.hasPlugin.mockImplementation((id: string) => byId.has(id));
  mocks.registry.getPlugin.mockImplementation((id: string) => byId.get(id));
  mocks.registry.getAllPlugins.mockImplementation(() =>
    entries.map((e) => e.plugin)
  );
  mocks.loader.updatePluginState.mockImplementation(
    (id: string, state: PluginState) => {
      const entry = byId.get(id);
      if (entry) entry.plugin.state = state;
    }
  );
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('PluginManager branches', () => {
  let manager: PluginManager;

  beforeEach(() => {
    vi.resetAllMocks();
    manager = new PluginManager();

    mocks.registry.getAllPlugins.mockReturnValue([]);
    mocks.registry.getEnabledPlugins.mockReturnValue([]);
    mocks.registry.enablePlugin.mockResolvedValue(undefined);
    mocks.registry.disablePlugin.mockResolvedValue(undefined);
    mocks.registry.unregisterPlugin.mockResolvedValue(undefined);
    mocks.depResolver.getDependents.mockReturnValue([]);
    mocks.depResolver.validateDependencies.mockReturnValue({
      valid: true,
      missing: [],
      incompatible: [],
      circular: [],
    });
    mocks.license.checkLicense.mockReturnValue({ valid: true });
    mocks.loader.getPluginPath.mockResolvedValue('/plugins/p1');
    mocks.loader.unloadPluginCode.mockResolvedValue(undefined);
    mocks.loader.acquireModuleHandle.mockResolvedValue(
      new LocalPluginModule({})
    );
    mocks.storage.migrateFromJson.mockResolvedValue(undefined);
    mocks.dataLoader.loadPluginData.mockResolvedValue([]);
    mocks.createPluginContext.mockReturnValue(CONTEXT);
    mocks.pathService.isBundledPluginId.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('checkForUpdates', () => {
    it('ignores updates for unknown plugins and entries without an update', async () => {
      vi.stubEnv('MARKETPLACE_ENABLED', 'true');
      const entry = makeEntry('p1');
      seedRegistry(entry);
      mocks.marketplace.checkForUpdates.mockResolvedValue({
        success: true,
        data: [
          { pluginId: 'gone', hasUpdate: true, latestVersion: '9.0.0' },
          { pluginId: 'p1', hasUpdate: false, latestVersion: '1.0.0' },
        ],
      });

      await manager.checkForUpdates();

      expect(mocks.marketplace.checkForUpdates).toHaveBeenCalledWith([
        { id: 'p1', version: '1.0.0' },
      ]);
      expect(entry.plugin.hasUpdate).toBeUndefined();
      expect(entry.plugin.latestVersion).toBeUndefined();
    });
  });

  describe('disable while the activation settles', () => {
    /**
     * Starts an Enable whose activate() hook waits for `gate`, and resolves
     * once that hook is running (the activation is in flight).
     */
    async function startBlockedActivation(entry: PluginRegistryEntry) {
      const gate = deferred();
      const hooks = {
        activate: vi.fn(() => gate.promise),
        deactivate: vi.fn(),
      };
      mocks.loader.acquireModuleHandle.mockResolvedValue(
        new LocalPluginModule(hooks)
      );
      seedRegistry(entry);
      const enabling = manager.enablePlugin('p1');
      await vi.waitFor(() => expect(hooks.activate).toHaveBeenCalled());
      return { gate, hooks, enabling };
    }

    it('deactivates a plugin whose activation completed before the registry write landed', async () => {
      const entry = makeEntry('p1');
      const { gate, hooks, enabling } = await startBlockedActivation(entry);
      // The activation finishes (and marks the plugin enabled) while the
      // registry is still being written; only then does the write land.
      mocks.registry.disablePlugin.mockImplementation(async () => {
        gate.resolve();
        await enabling;
        entry.config.enabled = false;
      });

      const cascaded = await manager.disablePlugin('p1');

      expect(cascaded).toEqual([]);
      expect(mocks.eventBus.emitPluginActivated).toHaveBeenCalledWith('p1');
      expect(hooks.deactivate).toHaveBeenCalledTimes(1);
      expect(mocks.loader.releaseModuleHandle).toHaveBeenCalledWith('p1');
      expect(mocks.registry.clearPluginContext).toHaveBeenCalledWith('p1');
      expect(mocks.eventBus.emitPluginDeactivated).toHaveBeenCalledTimes(1);
      expect(entry.plugin.state).toBe('disabled');
    });

    it('leaves alone a plugin whose activation already stopped itself', async () => {
      const entry = makeEntry('p1');
      const { gate, hooks, enabling } = await startBlockedActivation(entry);
      // The write lands first: the activation sees "disabled" when it
      // settles and stops its own instance.
      mocks.registry.disablePlugin.mockImplementation(async () => {
        entry.config.enabled = false;
        gate.resolve();
        await enabling;
      });

      const cascaded = await manager.disablePlugin('p1');

      expect(cascaded).toEqual([]);
      expect(mocks.eventBus.emitPluginActivated).not.toHaveBeenCalled();
      expect(hooks.deactivate).toHaveBeenCalledTimes(1);
      expect(mocks.eventBus.emitPluginDeactivated).toHaveBeenCalledTimes(1);
      expect(mocks.registry.setPluginContext).not.toHaveBeenCalled();
      expect(entry.plugin.state).toBe('disabled');
    });
  });

  describe('reloadPlugin', () => {
    it('refuses an unknown plugin', async () => {
      seedRegistry();
      await expect(manager.reloadPlugin('nope')).rejects.toThrow(
        'Plugin nope not found'
      );
      expect(mocks.loader.unloadPluginCode).not.toHaveBeenCalled();
    });

    it('refuses a plugin whose directory cannot be found', async () => {
      seedRegistry(makeEntry('p1', { state: 'enabled' }));
      mocks.loader.getPluginPath.mockResolvedValue(null);

      await expect(manager.reloadPlugin('p1')).rejects.toThrow(
        'Could not find path for plugin p1'
      );
      expect(mocks.loader.unloadPluginCode).not.toHaveBeenCalled();
    });
  });

  describe('watchPlugin', () => {
    it('reloads the plugin when the watcher reports a change', async () => {
      const reload = vi.spyOn(manager, 'reloadPlugin').mockResolvedValue();
      await manager.watchPlugin('p1');

      const [watchedId, onReload] = mocks.watcher.watch.mock.calls[0] as [
        string,
        (id: string) => Promise<void>,
      ];
      expect(watchedId).toBe('p1');
      await onReload('p1');

      expect(reload).toHaveBeenCalledWith('p1');
    });
  });

  describe('activation failures', () => {
    it('marks a plugin that vanished from the registry as errored', async () => {
      // hasPlugin and getPlugin disagree: the entry went away in between.
      mocks.registry.hasPlugin.mockReturnValue(true);
      mocks.registry.getPlugin.mockReturnValue(undefined);

      await expect(manager.enablePlugin('p1')).rejects.toThrow(
        'Plugin p1 not found'
      );
      expect(mocks.loader.updatePluginState).toHaveBeenCalledWith(
        'p1',
        'error',
        'Plugin p1 not found'
      );
      expect(mocks.loader.acquireModuleHandle).not.toHaveBeenCalled();
    });

    it('marks a plugin without a directory as errored', async () => {
      const entry = makeEntry('p1');
      seedRegistry(entry);
      mocks.loader.getPluginPath.mockResolvedValue(null);

      await expect(manager.enablePlugin('p1')).rejects.toThrow(
        'Plugin path not found for p1'
      );
      expect(mocks.loader.updatePluginState).toHaveBeenNthCalledWith(
        1,
        'p1',
        'loading'
      );
      expect(entry.plugin.state).toBe('error');
      expect(mocks.createPluginContext).not.toHaveBeenCalled();
    });

    it('reports incompatible and circular dependencies without a missing list', async () => {
      seedRegistry(makeEntry('p1'));
      mocks.depResolver.validateDependencies.mockReturnValue({
        valid: false,
        missing: [],
        incompatible: [
          { pluginId: 'dep', required: '^2.0.0', installed: '1.0.0' },
        ],
        circular: [['p1', 'dep', 'p1']],
      });

      const error = await manager.enablePlugin('p1').catch((e: Error) => e);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        'Cannot activate plugin p1:\n' +
          'Incompatible dependencies:\n' +
          '  - dep: requires ^2.0.0, but 1.0.0 is installed\n' +
          'Circular dependencies detected: p1 -> dep -> p1'
      );
    });
  });

  describe('dependencies at activation', () => {
    it('does not enable a dependency that is already enabled or not registered', async () => {
      const main = makeEntry('p1', {
        dependencies: { 'dep-on': '^1.0.0', 'dep-unknown': '^1.0.0' },
      });
      const depOn = makeEntry('dep-on', { enabled: true, state: 'enabled' });
      seedRegistry(main, depOn);

      const autoEnabled = await manager.enablePlugin('p1');

      expect(autoEnabled).toEqual([]);
      expect(mocks.registry.enablePlugin).toHaveBeenCalledTimes(1);
      expect(mocks.registry.enablePlugin).toHaveBeenCalledWith('p1');
      expect(main.plugin.state).toBe('enabled');
    });
  });

  describe('disablePlugin', () => {
    it('only writes the registry when the plugin entry is gone', async () => {
      // hasPlugin still answers true, but there is nothing to deactivate.
      mocks.registry.hasPlugin.mockReturnValue(true);
      mocks.registry.getPlugin.mockReturnValue(undefined);

      await expect(manager.disablePlugin('p1')).resolves.toEqual([]);

      expect(mocks.loader.getPluginPath).not.toHaveBeenCalled();
      expect(mocks.loader.releaseModuleHandle).not.toHaveBeenCalled();
      expect(mocks.eventBus.emitPluginDeactivated).not.toHaveBeenCalled();
      expect(mocks.registry.disablePlugin).toHaveBeenCalledWith('p1');
    });
  });

  describe('getPluginExtensions', () => {
    beforeEach(() => {
      mocks.extensions.getAllPluginExtensions.mockReturnValue(
        new Map<string, unknown>([
          ['on', { sidebar: [{ id: 's1' }] }],
          ['off', { sidebar: [{ id: 's2' }] }],
        ])
      );
      mocks.registry.isPluginEnabled.mockImplementation(
        (id: string) => id === 'on'
      );
    });

    it('returns every extension of the enabled plugins when no point is given', () => {
      expect(manager.getPluginExtensions()).toEqual([
        { pluginId: 'on', extensions: { sidebar: [{ id: 's1' }] } },
      ]);
    });

    it('skips disabled plugins for a given extension point', () => {
      expect(manager.getPluginExtensions('sidebar')).toEqual([{ id: 's1' }]);
    });
  });

  describe('executePluginAction', () => {
    it('refuses a plugin that is not registered', async () => {
      seedRegistry();
      await expect(
        manager.executePluginAction('nope', 'refresh')
      ).rejects.toThrow('Plugin nope not found');
      expect(mocks.registry.isPluginEnabled).not.toHaveBeenCalled();
    });

    it('refuses an enabled plugin whose directory is gone', async () => {
      seedRegistry(makeEntry('p1', { state: 'enabled' }));
      mocks.registry.isPluginEnabled.mockReturnValue(true);
      mocks.loader.getPluginPath.mockResolvedValue(null);

      await expect(
        manager.executePluginAction('p1', 'refresh')
      ).rejects.toThrow('Plugin path not found for p1');
      expect(mocks.loader.acquireModuleHandle).not.toHaveBeenCalled();
    });
  });

  describe('uninstallPlugin', () => {
    it('logs and skips file deletion when the plugin path is unknown', async () => {
      seedRegistry(makeEntry('p1', { enabled: false }));
      mocks.registry.isPluginEnabled.mockReturnValue(false);
      mocks.loader.getPluginPath.mockResolvedValue(null);

      await manager.uninstallPlugin('p1');

      expect(mocks.registry.unregisterPlugin).toHaveBeenCalledWith('p1');
      expect(mocks.loader.unregisterPlugin).toHaveBeenCalledWith('p1');
      expect(mocks.log.error).toHaveBeenCalledWith(
        '[ERROR] getPluginPath returned undefined for p1'
      );
      expect(mocks.fsPromises.rm).not.toHaveBeenCalled();
      expect(mocks.storage.clear).not.toHaveBeenCalled();
      expect(mocks.log.info).toHaveBeenCalledWith(
        '[PluginManager] Plugin p1 uninstalled successfully'
      );
    });
  });

  describe('importPlugin', () => {
    it('refuses a manifest without an id before copying anything', async () => {
      mocks.fsPromises.stat.mockResolvedValue({ isDirectory: () => true });
      mocks.fsPromises.readFile.mockResolvedValue('{"name":"No id"}');

      await expect(manager.importPlugin('/src/plugin')).rejects.toThrow(
        'Invalid manifest: missing plugin ID'
      );
      expect(mocks.signature.checkPlugin).not.toHaveBeenCalled();
      expect(mocks.fsPromises.cp).not.toHaveBeenCalled();
    });
  });
});
