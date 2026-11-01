/**
 * PluginHostManager paths the main suite leaves out: host output logging,
 * load and invoke timeouts, replaced and cleanly exiting hosts, failing
 * cleanups, and the default Electron fork.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { createRequire } from 'module';
import path from 'path';
import {
  PluginHostManager,
  type RemotePluginModule,
  type UtilityProcessLike,
} from '../services/plugins/host/plugin-host-manager';
import { hostEnvironment } from '../services/plugins/host/host-environment';
import { pluginEventBus } from '../services/plugins/plugin-events';
import type {
  HostToMainMessage,
  MainToHostMessage,
} from '../services/plugins/host/host-protocol';
import type { PluginContext } from '../types/plugin-types';
import log from '../logger';

vi.mock('../logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

class FakeChild implements UtilityProcessLike {
  sent: MainToHostMessage[] = [];
  kill = vi.fn();
  stdout: NodeJS.ReadableStream | null = null;
  stderr: NodeJS.ReadableStream | null = null;
  private listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  postMessage(message: unknown): void {
    this.sent.push(message as MainToHostMessage);
  }

  on(event: 'message', listener: (message: unknown) => void): this;
  on(event: 'exit', listener: (code: number) => void): this;
  on(event: string, listener: (...args: never[]) => void): this {
    (this.listeners[event] ??= []).push(
      listener as (...args: unknown[]) => void
    );
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners[event] ?? []) listener(...args);
  }

  emitHostMessage(message: HostToMainMessage): void {
    this.emit('message', message);
  }

  ofType<T extends MainToHostMessage['type']>(
    type: T
  ): Extract<MainToHostMessage, { type: T }>[] {
    return this.sent.filter((m) => m.type === type) as Extract<
      MainToHostMessage,
      { type: T }
    >[];
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const SPAWN_OPTIONS = {
  pluginId: 'p1',
  pluginPath: '/plugins/p1',
  mainFile: '/plugins/p1/index.js',
  permissions: ['kubernetes'],
  hostModulePath: '/host/plugin-host.js',
};

// The manager loads Electron with a plain require() (so unit tests that mock
// 'electron' never reach it); a cache entry stands in for the module here.
const nodeRequire = createRequire(__filename);
const electronId = nodeRequire.resolve('electron');

function withElectron<T>(electronExports: unknown, run: () => T): T {
  const previous = nodeRequire.cache[electronId];
  nodeRequire.cache[electronId] = {
    id: electronId,
    filename: electronId,
    loaded: true,
    exports: electronExports,
  } as NodeJS.Module;
  try {
    return run();
  } finally {
    if (previous) nodeRequire.cache[electronId] = previous;
    else delete nodeRequire.cache[electronId];
  }
}

describe('PluginHostManager branches', () => {
  let child: FakeChild;
  let manager: PluginHostManager;
  let context: PluginContext;
  let fork: ReturnType<typeof vi.fn<(m: string, s: string) => FakeChild>>;

  const spawn = async (
    exports: string[] = ['activate', 'myAction']
  ): Promise<RemotePluginModule> => {
    const promise = manager.spawn({ ...SPAWN_OPTIONS, context });
    child.emitHostMessage({ type: 'loaded', exports });
    return promise;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    child = new FakeChild();
    fork = vi.fn(() => child);
    manager = new PluginHostManager(fork);
    context = {
      pluginId: 'p1',
      pluginPath: '/plugins/p1',
      kubernetes: { watchResources: vi.fn() },
      ui: {},
      storage: { get: vi.fn() },
      logger: {},
      events: { offBroadcast: vi.fn() },
    } as unknown as PluginContext;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('host output', () => {
    it('logs stdout and stderr chunks under the plugin id, clipping long ones', async () => {
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      child.stdout = stdout as unknown as NodeJS.ReadableStream;
      child.stderr = stderr as unknown as NodeJS.ReadableStream;
      await spawn();

      stdout.emit('data', Buffer.from('hello from the plugin\n'));
      stderr.emit('data', Buffer.from('x'.repeat(2500)));

      expect(log.info).toHaveBeenCalledWith(
        '[PluginHost:p1]',
        'hello from the plugin'
      );
      expect(log.error).toHaveBeenCalledWith(
        '[PluginHost:p1]',
        `${'x'.repeat(2000)}... (2500 chars)`
      );
    });
  });

  describe('spawn', () => {
    it('loads the host module next to the manager by default', async () => {
      const promise = manager.spawn({
        pluginId: 'p1',
        pluginPath: '/plugins/p1',
        mainFile: '/plugins/p1/index.js',
        permissions: [],
        context,
      });
      child.emitHostMessage({ type: 'loaded', exports: [] });
      await promise;

      expect(fork).toHaveBeenCalledWith(
        path.join(
          __dirname,
          '..',
          'services',
          'plugins',
          'host',
          'plugin-host.js'
        ),
        'plugin-p1'
      );
    });

    it('replaces the running host of a plugin, and the old exit leaves the new one alone', async () => {
      const first = child;
      await spawn();
      child = new FakeChild();
      fork.mockReturnValue(child);
      await spawn();

      expect(first.ofType('shutdown')).toHaveLength(1);
      expect(first.kill).toHaveBeenCalled();
      expect(fork).toHaveBeenCalledTimes(2);

      first.emit('exit', 1);

      expect(manager.isRunning('p1')).toBe(true);
      expect(log.error).not.toHaveBeenCalledWith(
        expect.stringContaining('exited unexpectedly')
      );
    });

    it('gives up on a host that does not load in time', async () => {
      vi.useFakeTimers();
      const promise = manager.spawn({ ...SPAWN_OPTIONS, context });
      const assertion = expect(promise).rejects.toThrow(
        'Plugin p1 did not load within 15000ms'
      );

      await vi.advanceTimersByTimeAsync(15_000);

      await assertion;
      expect(child.kill).toHaveBeenCalled();
      expect(manager.isRunning('p1')).toBe(false);
    });

    it('ignores messages other than the load handshake while loading', async () => {
      const promise = manager.spawn({ ...SPAWN_OPTIONS, context });
      child.emitHostMessage({ type: 'unsubscribe', cbId: 1 });
      child.emitHostMessage({ type: 'loaded', exports: ['activate'] });

      const module = await promise;
      expect(module.has('activate')).toBe(true);
    });
  });

  describe('host exit', () => {
    it('logs a clean exit as information and forgets the host', async () => {
      await spawn();
      child.emit('exit', 0);

      expect(log.info).toHaveBeenCalledWith(
        '[PluginHostManager] Host for p1 exited'
      );
      expect(log.error).not.toHaveBeenCalled();
      expect(manager.isRunning('p1')).toBe(false);
    });
  });

  describe('invoke', () => {
    it('times out a call the host never answers and drops its late result', async () => {
      vi.useFakeTimers();
      const module = await spawn();
      const pending = module.invoke('myAction');
      const assertion = expect(pending).rejects.toThrow(
        'Plugin p1: "myAction" timed out after 30000ms'
      );

      await vi.advanceTimersByTimeAsync(30_000);
      await assertion;

      // The late answer (and one for an id that never existed) is ignored.
      const id = child.ofType('invoke')[0].id;
      expect(() => {
        child.emitHostMessage({ type: 'invoke-result', id, ok: true });
        child.emitHostMessage({ type: 'invoke-result', id: 999, ok: true });
      }).not.toThrow();
    });

    it('sends lifecycle hooks with the context flag and no arguments', async () => {
      const module = await spawn();
      const pending = module.invoke('activate', { withContext: true });

      expect(child.ofType('invoke')[0]).toEqual({
        type: 'invoke',
        id: 1,
        name: 'activate',
        withContext: true,
        args: [],
      });
      child.emitHostMessage({ type: 'invoke-result', id: 1, ok: true });
      await expect(pending).resolves.toBeUndefined();
    });

    it('rejects with a generic message when the host reports no error text', async () => {
      const module = await spawn();
      const pending = module.invoke('myAction');
      const id = child.ofType('invoke')[0].id;
      child.emitHostMessage({ type: 'invoke-result', id, ok: false });

      await expect(pending).rejects.toThrow('Unknown error');
    });
  });

  describe('context calls', () => {
    it('logs a fire-and-forget notification it refuses', async () => {
      await spawn();
      child.emitHostMessage({
        type: 'context-notify',
        path: 'process.exit',
        args: [],
      });

      expect(log.warn).toHaveBeenCalledWith(
        '[PluginHostManager] p1 process.exit failed:',
        'Context method not allowed: process.exit'
      );
    });

    it('replies with an error for an allowed method the context does not have', async () => {
      await spawn();
      child.emitHostMessage({
        type: 'context-call',
        id: 3,
        path: 'storage.clear',
        args: [],
      });
      await flush();

      expect(child.ofType('context-result')).toEqual([
        {
          type: 'context-result',
          id: 3,
          ok: false,
          result: undefined,
          error: 'Context method not found: storage.clear',
        },
      ]);
    });

    it('sends a result that JSON cannot represent as its string form', async () => {
      vi.mocked(context.storage.get).mockResolvedValue(10n);
      await spawn();
      child.emitHostMessage({
        type: 'context-call',
        id: 2,
        path: 'storage.get',
        args: ['counter'],
      });
      await flush();

      expect(child.ofType('context-result')).toEqual([
        { type: 'context-result', id: 2, ok: true, result: '10' },
      ]);
    });

    it('drops the answer to a call that settles after the host was disposed', async () => {
      let answer!: (value: unknown) => void;
      vi.mocked(context.storage.get).mockReturnValue(
        new Promise((resolve) => {
          answer = resolve;
        })
      );
      const module = await spawn();
      child.emitHostMessage({
        type: 'context-call',
        id: 4,
        path: 'storage.get',
        args: ['key'],
      });
      module.dispose();
      answer('late');
      await flush();

      expect(child.ofType('context-result')).toEqual([]);
    });

    it('keeps no cleanup for a watch without one or for callbacks of other methods', async () => {
      const offSpy = vi.spyOn(pluginEventBus, 'off');
      vi.mocked(context.kubernetes.watchResources).mockReturnValue(
        undefined as unknown as () => void
      );
      vi.mocked(context.storage.get).mockResolvedValue('v');
      const module = await spawn();
      child.emitHostMessage({
        type: 'context-call',
        id: 5,
        path: 'kubernetes.watchResources',
        args: ['pods'],
        callbacks: [{ index: 1, cbId: 7 }],
      });
      child.emitHostMessage({
        type: 'context-call',
        id: 6,
        path: 'storage.get',
        args: ['key'],
        callbacks: [{ index: 1, cbId: 8 }],
      });
      await flush();

      expect(child.ofType('context-result')).toEqual([
        { type: 'context-result', id: 5, ok: true, result: null },
        { type: 'context-result', id: 6, ok: true, result: 'v' },
      ]);
      // Unsubscribing either id finds nothing to release.
      child.emitHostMessage({ type: 'unsubscribe', cbId: 7 });
      child.emitHostMessage({ type: 'unsubscribe', cbId: 8 });
      module.dispose();

      expect(offSpy).not.toHaveBeenCalled();
      expect(context.events.offBroadcast).not.toHaveBeenCalled();
      expect(log.warn).not.toHaveBeenCalled();
      offSpy.mockRestore();
    });
  });

  describe('subscription cleanups that throw', () => {
    const subscribeWatch = async (): Promise<RemotePluginModule> => {
      vi.mocked(context.kubernetes.watchResources).mockReturnValue(() => {
        throw new Error('cleanup boom');
      });
      const module = await spawn();
      child.emitHostMessage({
        type: 'context-call',
        id: 9,
        path: 'kubernetes.watchResources',
        args: ['pods'],
        callbacks: [{ index: 1, cbId: 2 }],
      });
      await flush();
      return module;
    };

    it('logs a failed unsubscribe', async () => {
      await subscribeWatch();
      child.emitHostMessage({ type: 'unsubscribe', cbId: 2 });

      expect(log.warn).toHaveBeenCalledWith(
        '[PluginHostManager] Unsubscribe failed for p1:',
        'cleanup boom'
      );
    });

    it('logs a failed cleanup on teardown and still stops the host', async () => {
      const module = await subscribeWatch();
      module.dispose();

      expect(log.warn).toHaveBeenCalledWith(
        '[PluginHostManager] Cleanup failed for p1:',
        'cleanup boom'
      );
      expect(child.kill).toHaveBeenCalled();
      expect(manager.isRunning('p1')).toBe(false);
    });
  });

  describe('default Electron fork', () => {
    it('forks the host through utilityProcess with the trimmed environment', async () => {
      const electronFork = vi.fn(() => child);
      const promise = withElectron(
        { utilityProcess: { fork: electronFork } },
        () => {
          const real = new PluginHostManager();
          expect(real.isSupported()).toBe(true);
          return real.spawn({ ...SPAWN_OPTIONS, context });
        }
      );
      child.emitHostMessage({ type: 'loaded', exports: [] });
      await promise;

      expect(electronFork).toHaveBeenCalledWith('/host/plugin-host.js', [], {
        serviceName: 'plugin-p1',
        stdio: 'pipe',
        env: hostEnvironment(process.env),
      });
    });

    it('reports isolation as unsupported when Electron cannot be loaded', () => {
      const unsupported = withElectron(
        {
          get utilityProcess(): never {
            throw new Error('not running in Electron main');
          },
        },
        () => new PluginHostManager().isSupported()
      );

      expect(unsupported).toBe(false);
    });
  });
});
