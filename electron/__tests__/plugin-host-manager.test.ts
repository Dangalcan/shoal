import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PluginHostManager,
  RemotePluginModule,
  type UtilityProcessLike,
} from '../services/plugins/host/plugin-host-manager';
import { pluginEventBus } from '../services/plugins/plugin-events';
import type {
  HostToMainMessage,
  MainToHostMessage,
} from '../services/plugins/host/host-protocol';
import type { PluginContext } from '../types/plugin-types';

vi.mock('../logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

class FakeChild implements UtilityProcessLike {
  sent: MainToHostMessage[] = [];
  kill = vi.fn();
  stdout = null;
  stderr = null;
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

describe('PluginHostManager', () => {
  let child: FakeChild;
  let manager: PluginHostManager;
  let watchCleanup: ReturnType<typeof vi.fn>;
  let context: PluginContext;

  const spawn = async (
    exports: string[] = ['activate', 'deactivate', 'myAction']
  ): Promise<RemotePluginModule> => {
    const promise = manager.spawn({
      pluginId: 'p1',
      pluginPath: '/plugins/p1',
      mainFile: '/plugins/p1/index.js',
      permissions: ['kubernetes', 'ui', 'storage'],
      context,
      hostModulePath: '/host/plugin-host.js',
    });
    child.emitHostMessage({ type: 'loaded', exports });
    return promise;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    child = new FakeChild();
    manager = new PluginHostManager(() => child);
    watchCleanup = vi.fn();
    context = {
      pluginId: 'p1',
      pluginPath: '/plugins/p1',
      kubernetes: {
        getResources: vi.fn().mockResolvedValue([{ name: 'pod-a' }]),
        watchResources: vi.fn().mockReturnValue(watchCleanup),
      },
      ui: {
        showNotification: vi.fn(),
      },
      storage: {
        get: vi.fn().mockResolvedValue('stored-value'),
        set: vi.fn().mockRejectedValue(new Error('disk full')),
      },
      logger: {
        info: vi.fn(),
      },
      events: {
        onBroadcast: vi.fn(),
        offBroadcast: vi.fn(),
        broadcast: vi.fn(),
        onResourceCreated: vi.fn(),
      },
    } as unknown as PluginContext;
  });

  it('spawns a host, sends init, and resolves with the export list', async () => {
    const module = await spawn(['activate', 'myAction']);
    expect(child.ofType('init')[0]).toMatchObject({
      pluginId: 'p1',
      mainFile: '/plugins/p1/index.js',
      permissions: ['kubernetes', 'ui', 'storage'],
    });
    expect(module.has('activate')).toBe(true);
    expect(module.has('nope')).toBe(false);
    expect(module.isRemote).toBe(true);
    expect(manager.isRunning('p1')).toBe(true);
  });

  it('rejects the spawn when the plugin fails to load', async () => {
    const promise = manager.spawn({
      pluginId: 'p1',
      pluginPath: '/plugins/p1',
      mainFile: '/plugins/p1/index.js',
      permissions: [],
      context,
      hostModulePath: '/host/plugin-host.js',
    });
    child.emitHostMessage({ type: 'load-error', error: 'syntax error' });
    await expect(promise).rejects.toThrow('syntax error');
    expect(child.kill).toHaveBeenCalled();
    expect(manager.isRunning('p1')).toBe(false);
  });

  it('rejects the spawn when the host exits before loading', async () => {
    const promise = manager.spawn({
      pluginId: 'p1',
      pluginPath: '/plugins/p1',
      mainFile: '/plugins/p1/index.js',
      permissions: [],
      context,
      hostModulePath: '/host/plugin-host.js',
    });
    child.emit('exit', 9);
    await expect(promise).rejects.toThrow('exited before loading');
  });

  it('invokes exports and resolves with the host result', async () => {
    const module = await spawn();
    const result = module.invoke('myAction', { args: [{ x: 1 }] });
    const invokeMsg = child.ofType('invoke')[0];
    expect(invokeMsg).toMatchObject({
      name: 'myAction',
      withContext: false,
      args: [{ x: 1 }],
    });
    child.emitHostMessage({
      type: 'invoke-result',
      id: invokeMsg.id,
      ok: true,
      result: 'done',
    });
    await expect(result).resolves.toBe('done');
  });

  it('rejects invocations the host reports as failed', async () => {
    const module = await spawn();
    const result = module.invoke('myAction');
    const invokeMsg = child.ofType('invoke')[0];
    child.emitHostMessage({
      type: 'invoke-result',
      id: invokeMsg.id,
      ok: false,
      error: 'action blew up',
    });
    await expect(result).rejects.toThrow('action blew up');
  });

  it('routes context calls to the real context and replies with the result', async () => {
    await spawn();
    child.emitHostMessage({
      type: 'context-call',
      id: 5,
      path: 'storage.get',
      args: ['my-key'],
    });
    await flush();
    expect(context.storage.get).toHaveBeenCalledWith('my-key');
    expect(child.ofType('context-result')[0]).toMatchObject({
      id: 5,
      ok: true,
      result: 'stored-value',
    });
  });

  it('replies with an error when a context call fails', async () => {
    await spawn();
    child.emitHostMessage({
      type: 'context-call',
      id: 6,
      path: 'storage.set',
      args: ['k', 'v'],
    });
    await flush();
    expect(child.ofType('context-result')[0]).toMatchObject({
      id: 6,
      ok: false,
      error: expect.stringContaining('disk full'),
    });
  });

  it('rejects context calls to non-allowlisted paths', async () => {
    await spawn();
    child.emitHostMessage({
      type: 'context-call',
      id: 7,
      path: 'constructor.constructor',
      args: [],
    });
    await flush();
    expect(child.ofType('context-result')[0]).toMatchObject({
      id: 7,
      ok: false,
      error: expect.stringContaining('not allowed'),
    });
  });

  it('executes fire-and-forget context notifications', async () => {
    await spawn();
    child.emitHostMessage({
      type: 'context-notify',
      path: 'ui.showNotification',
      args: ['hello', 'info'],
    });
    expect(context.ui.showNotification).toHaveBeenCalledWith('hello', 'info');
  });

  it('bridges watch callbacks to the host and honours unsubscribe', async () => {
    await spawn();
    child.emitHostMessage({
      type: 'context-call',
      id: 8,
      path: 'kubernetes.watchResources',
      args: ['pods'],
      callbacks: [{ index: 1, cbId: 42 }],
    });
    await flush();

    const watchMock = vi.mocked(context.kubernetes.watchResources);
    expect(watchMock).toHaveBeenCalledWith('pods', expect.any(Function));
    // Function results cannot cross the boundary; host receives null
    expect(child.ofType('context-result')[0]).toMatchObject({
      id: 8,
      ok: true,
      result: null,
    });

    const forwarder = watchMock.mock.calls[0][1];
    forwarder({ kind: 'ADDED' });
    expect(child.ofType('callback')[0]).toMatchObject({
      cbId: 42,
      args: [{ kind: 'ADDED' }],
    });

    child.emitHostMessage({ type: 'unsubscribe', cbId: 42 });
    expect(watchCleanup).toHaveBeenCalled();
  });

  it('cleans up broadcast subscriptions on dispose', async () => {
    const module = await spawn();
    child.emitHostMessage({
      type: 'context-call',
      id: 9,
      path: 'events.onBroadcast',
      args: ['refresh'],
      callbacks: [{ index: 1, cbId: 3 }],
    });
    await flush();
    const onBroadcastMock = vi.mocked(context.events.onBroadcast);
    expect(onBroadcastMock).toHaveBeenCalledWith(
      'refresh',
      expect.any(Function)
    );

    module.dispose();
    expect(context.events.offBroadcast).toHaveBeenCalledWith(
      'refresh',
      onBroadcastMock.mock.calls[0][1]
    );
    expect(child.ofType('shutdown')).toHaveLength(1);
    expect(child.kill).toHaveBeenCalled();
    expect(manager.isRunning('p1')).toBe(false);
  });

  it('cleans up app-event subscriptions via the plugin event bus', async () => {
    const offSpy = vi.spyOn(pluginEventBus, 'off');
    const module = await spawn();
    child.emitHostMessage({
      type: 'context-call',
      id: 10,
      path: 'events.onResourceCreated',
      args: [],
      callbacks: [{ index: 0, cbId: 4 }],
    });
    await flush();
    module.dispose();
    expect(offSpy).toHaveBeenCalledWith(
      'resource:created',
      expect.any(Function)
    );
    offSpy.mockRestore();
  });

  it('rejects in-flight invokes and cleans up when the host crashes', async () => {
    const module = await spawn();
    child.emitHostMessage({
      type: 'context-call',
      id: 11,
      path: 'kubernetes.watchResources',
      args: ['pods'],
      callbacks: [{ index: 1, cbId: 1 }],
    });
    await flush();

    const pending = module.invoke('myAction');
    child.emit('exit', 1);
    await expect(pending).rejects.toThrow('terminated');
    expect(watchCleanup).toHaveBeenCalled();
    expect(manager.isRunning('p1')).toBe(false);

    await expect(module.invoke('myAction')).rejects.toThrow('not running');
  });

  it('disposeAll tears down every running host', async () => {
    await spawn();
    manager.disposeAll();
    expect(child.kill).toHaveBeenCalled();
    expect(manager.isRunning('p1')).toBe(false);
  });
});
