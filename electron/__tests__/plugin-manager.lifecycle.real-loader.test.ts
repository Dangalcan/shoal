// @vitest-environment node
/**
 * PluginManager driven through the real PluginLoader, vm sandbox, registry
 * and storage against a throwaway in-process plugin written to a temp
 * directory.
 *
 * plugin-manager.lifecycle.test.ts mocks the loader, which is how two bugs
 * reached 0.9.0-rc.3 unseen: every module handle of an in-process plugin was
 * a fresh vm instance, so deactivate() cleared a timer that was never started
 * while the one activate() had started kept running; and a plugin that was
 * still activating at start-up was activated again by an Enable click. The
 * plugin here records its lifecycle calls and its timer ticks in plugin
 * storage, so a leaked timer or a double activation shows up as extra ticks
 * or activations.
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  afterAll,
} from 'vitest';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

vi.mock('electron', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  // One temp root per test file: userData holds plugin-config.json and the
  // plugin storage database; the app path's plugins/ directory stands in for
  // the bundled plugins, so the plugin runs in-process like resource-monitor.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-lifecycle-'));
  const userData = path.join(root, 'userData');
  const appPath = path.join(root, 'app');
  fs.mkdirSync(userData, { recursive: true });
  fs.mkdirSync(path.join(appPath, 'plugins'), { recursive: true });
  return {
    app: {
      isPackaged: false,
      getPath: (name: string) =>
        name === 'userData' ? userData : path.join(root, name),
      getAppPath: () => appPath,
    },
  };
});

vi.mock('../logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
  },
  getLogsDirectory: vi.fn(),
}));

// The only cluster call the plugin makes; the test decides when it answers.
vi.mock('../services/kubernetes/kubernetes-service', () => ({
  kubernetesService: { getResources: vi.fn() },
}));

import { PluginManager } from '../services/plugins/plugin-manager';
import { pluginLoader } from '../services/plugins/plugin-loader';
import { pluginRegistry } from '../services/plugins/plugin-registry';
import { storageService } from '../services/plugins/storage-service';
import { pathService } from '../services/plugins/path-service';
import { kubernetesService } from '../services/kubernetes/kubernetes-service';

const PLUGIN_ID = 'lifecycle-probe';
const TICK_MS = 1_000;

const MANIFEST = {
  id: PLUGIN_ID,
  name: 'Lifecycle probe',
  version: '1.0.0',
  description: 'Throwaway in-process plugin for the lifecycle tests',
  author: 'Shoal tests',
  main: 'index.js',
  permissions: ['kubernetes', 'storage'],
  license: { type: 'free', spdx: 'MIT' },
};

// CommonJS for the vm sandbox (plugin-sandbox.ts), shaped like
// plugins/resource-monitor/index.js: the timer and the context live in module
// variables because deactivate() receives no context. The counters in plugin
// storage survive a reload; `localActivations` does not, so it tells a fresh
// module instance from a reused one.
const PLUGIN_SOURCE = `
let interval = null;
let activeContext = null;
let localActivations = 0;

async function bump(context, key) {
  const n = (await context.storage.get(key)) || 0;
  await context.storage.set(key, n + 1);
}

module.exports = {
  activate: async (context) => {
    activeContext = context;
    localActivations += 1;
    await bump(context, 'activations');
    // The slow part of a real activation: a kubectl call.
    await context.kubernetes.getResources('namespaces', 'all');
    interval = setInterval(() => {
      bump(context, 'ticks').catch(() => {});
    }, ${TICK_MS});
  },

  deactivate: async () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    if (activeContext) await bump(activeContext, 'deactivations');
    activeContext = null;
  },

  localActivations: () => localActivations,
};
`;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const getResources = vi.mocked(kubernetesService.getResources);
const tmpRoot = path.dirname(app.getPath('userData'));
const pluginDir = path.join(pathService.getBundledPluginsDir(), PLUGIN_ID);
const configFile = path.join(app.getPath('userData'), 'plugin-config.json');

/** Counter the plugin keeps in its storage (0 until the first write). */
const probe = (key: string): number =>
  (storageService.get(PLUGIN_ID, key) as number | null) ?? 0;

/** What plugin-config.json says when the app starts. */
function writeConfig(config: Record<string, unknown>): void {
  fs.writeFileSync(configFile, JSON.stringify(config));
}

/** Starts the app with the plugin still waiting on its first cluster call. */
async function startWithActivationInFlight(manager: PluginManager) {
  writeConfig({ [PLUGIN_ID]: { enabled: true, settings: {} } });
  const reached = deferred<void>();
  const cluster = deferred<never[]>();
  getResources.mockImplementationOnce(() => {
    reached.resolve();
    return cluster.promise;
  });
  const startup = manager.initialize();
  await reached.promise;
  expect(manager.getPlugin(PLUGIN_ID)?.state).toBe('loading');
  return { startup, cluster };
}

describe('PluginManager with the real PluginLoader (in-process plugin)', () => {
  let manager: PluginManager;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    // The probe is not signed with the Shoal key: load it the way
    // `npm run dev` loads a plugin under development.
    vi.stubEnv('ALLOW_UNSIGNED_PLUGINS', 'true');
    getResources.mockReset();
    getResources.mockResolvedValue([]);

    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, 'plugin.json'),
      JSON.stringify(MANIFEST, null, 2)
    );
    fs.writeFileSync(path.join(pluginDir, 'index.js'), PLUGIN_SOURCE);
    writeConfig({});
    manager = new PluginManager();
  });

  afterEach(async () => {
    if (
      pluginRegistry.hasPlugin(PLUGIN_ID) &&
      pluginRegistry.isPluginEnabled(PLUGIN_ID)
    ) {
      await manager.disablePlugin(PLUGIN_ID);
    }
    pluginRegistry.clear();
    pluginLoader.unregisterPlugin(PLUGIN_ID);
    storageService.clear(PLUGIN_ID);
    vi.useRealTimers();
    vi.unstubAllEnvs();
    fs.rmSync(pluginDir, { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(configFile, { force: true });
  });

  afterAll(() => {
    // The storage database stays open for the whole file, and Windows does
    // not delete an open file.
    storageService['db']?.close();
    fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 3 });
  });

  it('runs the plugin in-process and discovers it as a bundled plugin', async () => {
    await manager.initialize();

    const plugin = manager.getPlugin(PLUGIN_ID);
    expect(plugin?.bundled).toBe(true);
    expect(plugin?.state).toBe('disabled');
    expect(pluginLoader['localHandles'].has(PLUGIN_ID)).toBe(false);

    await manager.enablePlugin(PLUGIN_ID);

    expect(manager.getPlugin(PLUGIN_ID)?.state).toBe('enabled');
    expect(pluginLoader['localHandles'].get(PLUGIN_ID)?.isRemote).toBe(false);
    expect(probe('activations')).toBe(1);
  });

  it('disable stops the interval that activate() started', async () => {
    await manager.initialize();
    await manager.enablePlugin(PLUGIN_ID);

    await vi.advanceTimersByTimeAsync(TICK_MS * 3);
    expect(probe('ticks')).toBe(3);

    await manager.disablePlugin(PLUGIN_ID);

    expect(manager.getPlugin(PLUGIN_ID)?.state).toBe('disabled');
    // rc.3: deactivate() ran in a fresh vm instance whose interval had never
    // been started, and the ticks went on.
    await vi.advanceTimersByTimeAsync(TICK_MS * 5);
    expect(probe('ticks')).toBe(3);
    // And it ran in the instance that holds the context activate() received.
    expect(probe('deactivations')).toBe(1);
  });

  it('an Enable click while start-up is still activating the plugin does not activate it twice', async () => {
    const { startup, cluster } = await startWithActivationInFlight(manager);

    await manager.enablePlugin(PLUGIN_ID);
    cluster.resolve([]);
    await startup;

    expect(manager.getPlugin(PLUGIN_ID)?.state).toBe('enabled');
    expect(probe('activations')).toBe(1);
    expect(getResources).toHaveBeenCalledTimes(1);
    // One interval, not two.
    await vi.advanceTimersByTimeAsync(TICK_MS * 3);
    expect(probe('ticks')).toBe(3);
    expect(
      await manager.executePluginAction(PLUGIN_ID, 'localActivations')
    ).toBe(1);
  });

  it('enabling again after a disable starts a fresh module instance once', async () => {
    await manager.initialize();
    await manager.enablePlugin(PLUGIN_ID);
    await manager.disablePlugin(PLUGIN_ID);

    await manager.enablePlugin(PLUGIN_ID);

    expect(manager.getPlugin(PLUGIN_ID)?.state).toBe('enabled');
    expect(probe('activations')).toBe(2);
    expect(probe('deactivations')).toBe(1);
    // Module state did not survive the disable: this instance has run
    // activate() once.
    expect(
      await manager.executePluginAction(PLUGIN_ID, 'localActivations')
    ).toBe(1);
    await vi.advanceTimersByTimeAsync(TICK_MS * 2);
    expect(probe('ticks')).toBe(2);
  });

  it('reload replaces the module instance and keeps a single interval', async () => {
    await manager.initialize();
    await manager.enablePlugin(PLUGIN_ID);
    const before = pluginLoader['localHandles'].get(PLUGIN_ID);
    await vi.advanceTimersByTimeAsync(TICK_MS);

    await manager.reloadPlugin(PLUGIN_ID);

    const after = pluginLoader['localHandles'].get(PLUGIN_ID);
    expect(after).toBeDefined();
    expect(after).not.toBe(before);
    expect(probe('activations')).toBe(2);
    expect(probe('deactivations')).toBe(1);
    expect(
      await manager.executePluginAction(PLUGIN_ID, 'localActivations')
    ).toBe(1);
    // One tick before the reload, two after it, from one interval.
    await vi.advanceTimersByTimeAsync(TICK_MS * 2);
    expect(probe('ticks')).toBe(3);
  });

  it('disable releases the module handle and actions stop reaching the plugin', async () => {
    await manager.initialize();
    await manager.enablePlugin(PLUGIN_ID);
    // Actions reach the instance activate() ran in.
    expect(
      await manager.executePluginAction(PLUGIN_ID, 'localActivations')
    ).toBe(1);

    await manager.disablePlugin(PLUGIN_ID);

    expect(pluginLoader['localHandles'].has(PLUGIN_ID)).toBe(false);
    expect(pluginLoader['sandboxCaches'].has(PLUGIN_ID)).toBe(false);
    await expect(
      manager.executePluginAction(PLUGIN_ID, 'localActivations')
    ).rejects.toThrow('not enabled');
  });

  it('a failed activation is rolled back in the instance that was activating', async () => {
    await manager.initialize();
    getResources.mockRejectedValueOnce(new Error('cluster unreachable'));

    await expect(manager.enablePlugin(PLUGIN_ID)).rejects.toThrow(
      'cluster unreachable'
    );

    expect(manager.getPlugin(PLUGIN_ID)?.state).toBe('error');
    expect(probe('activations')).toBe(1);
    expect(probe('deactivations')).toBe(1);
    expect(pluginLoader['localHandles'].has(PLUGIN_ID)).toBe(false);
    await vi.advanceTimersByTimeAsync(TICK_MS * 3);
    expect(probe('ticks')).toBe(0);
  });

  // #78: disablePlugin() during an activation used to run deactivate() before
  // activate() had started its timer; the activation then finished, started
  // the interval and marked the plugin enabled although the registry had it
  // disabled. Now the disable flips the registry and the activation stops
  // its own instance when it settles.
  it('disabling a plugin that is still activating stops the timer activate() goes on to start', async () => {
    const { startup, cluster } = await startWithActivationInFlight(manager);

    await manager.disablePlugin(PLUGIN_ID);
    cluster.resolve([]);
    await startup;

    expect(pluginRegistry.isPluginEnabled(PLUGIN_ID)).toBe(false);
    expect(manager.getPlugin(PLUGIN_ID)?.state).toBe('disabled');
    await vi.advanceTimersByTimeAsync(TICK_MS * 3);
    expect(probe('ticks')).toBe(0);
  });
});
