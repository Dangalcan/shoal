import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PluginHostRuntime } from '../services/plugins/host/plugin-host';
import type {
  HostToMainMessage,
  MainToHostMessage,
} from '../services/plugins/host/host-protocol';

/** In-memory stand-in for the utility-process parent port. */
class FakePort {
  sent: HostToMainMessage[] = [];
  private listener: ((message: MainToHostMessage) => void) | null = null;

  postMessage(message: HostToMainMessage): void {
    this.sent.push(message);
  }

  onMessage(listener: (message: MainToHostMessage) => void): void {
    this.listener = listener;
  }

  emit(message: MainToHostMessage): void {
    this.listener?.(message);
  }

  ofType<T extends HostToMainMessage['type']>(
    type: T
  ): Extract<HostToMainMessage, { type: T }>[] {
    return this.sent.filter((m) => m.type === type) as Extract<
      HostToMainMessage,
      { type: T }
    >[];
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const PLUGIN_SOURCE = `
let ctx = null;
let stopWatchFn = null;
const received = [];

exports.someValue = 42;

exports.activate = async (context) => {
  ctx = context;
};

exports.fetchPods = async () => {
  return ctx.kubernetes.getResources('pods', 'default');
};

exports.startWatch = () => {
  stopWatchFn = ctx.kubernetes.watchResources('pods', (event) => {
    received.push(event);
  });
  return 'started';
};

exports.stopWatch = () => {
  stopWatchFn();
  return 'stopped';
};

exports.getReceived = () => received;

exports.tryDeniedStorage = async () => {
  try {
    await ctx.storage.get('key');
    return 'no-throw';
  } catch (error) {
    return error.message;
  }
};

exports.notifyTwice = () => [
  ctx.ui.notifyOnce('dup-key', 'msg', 'info'),
  ctx.ui.notifyOnce('dup-key', 'msg', 'info'),
];

exports.localEvents = () => {
  const seen = [];
  const handler = (value) => seen.push(value);
  ctx.events.on('ping', handler);
  ctx.events.emit('ping', 'one');
  ctx.events.off('ping', handler);
  ctx.events.emit('ping', 'two');
  return seen;
};

exports.logSomething = () => {
  ctx.logger.info('hello', { detail: 1 });
  return true;
};

exports.explode = () => {
  throw new Error('plugin exploded');
};

exports.circular = () => {
  const a = {};
  a.self = a;
  return a;
};

exports.k8sWrites = async () => {
  await ctx.kubernetes.createResource({ kind: 'ConfigMap' });
  await ctx.kubernetes.updateResource('configmaps', 'cm', { kind: 'ConfigMap' });
  await ctx.kubernetes.deleteResource('configmaps', 'cm', 'default');
  await ctx.kubernetes.executeCommand('pod-a', 'default', 'ls /');
  return ctx.kubernetes.getPodMetrics('default');
};

exports.uiCalls = () => {
  ctx.ui.registerSidebarItem({ id: 'side', label: 'Side' });
  ctx.ui.registerPage('/page', 'PageComponent');
  ctx.ui.registerResourceAction('pods', { id: 'act', label: 'Act' });
  ctx.ui.showNotification('hello', 'success');
  ctx.ui.openModal('modal-id', { a: 1 });
  const errors = [];
  try {
    ctx.ui.registerPage('/page', () => null);
  } catch (error) {
    errors.push(error.message);
  }
  try {
    ctx.ui.openModal(() => null);
  } catch (error) {
    errors.push(error.message);
  }
  return errors;
};

exports.storageCalls = async () => {
  await ctx.storage.set('k', { v: 1 });
  const got = await ctx.storage.get('k');
  await ctx.storage.delete('k');
  await ctx.storage.clear();
  return got;
};

exports.eventsOnce = () => {
  const seen = [];
  ctx.events.once('tick', (value) => seen.push(value));
  ctx.events.emit('tick', 1);
  ctx.events.emit('tick', 2);
  return seen;
};

exports.broadcasts = () => {
  const handler = (value) => received.push(value);
  ctx.events.broadcast('global', 'payload');
  ctx.events.onBroadcast('global', handler);
  ctx.events.offBroadcast('global', handler);
  ctx.events.offBroadcast('global', () => {});
  return 'ok';
};

exports.lifecycleSubscriptions = () => {
  ctx.events.onClusterConnected(() => {});
  ctx.events.onClusterDisconnected(() => {});
  ctx.events.onResourceCreated(() => {});
  ctx.events.onResourceUpdated(() => {});
  ctx.events.onResourceDeleted(() => {});
  return 'ok';
};
`;

describe('PluginHostRuntime', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-host-test-'));
  const mainFile = path.join(tmpDir, 'index.js');
  fs.writeFileSync(mainFile, PLUGIN_SOURCE);

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  let port: FakePort;
  let exit: ReturnType<typeof vi.fn<(code: number) => void>>;
  let runtime: PluginHostRuntime;

  const init = (permissions: string[] = ['kubernetes', 'ui']) => {
    port.emit({
      type: 'init',
      pluginId: 'test-plugin',
      pluginPath: tmpDir,
      mainFile,
      permissions,
    });
  };

  const invoke = (
    id: number,
    name: string,
    withContext = false,
    args: unknown[] = []
  ) => {
    port.emit({ type: 'invoke', id, name, withContext, args });
  };

  const resultFor = (id: number) =>
    port.ofType('invoke-result').find((m) => m.id === id);

  /**
   * Answers the newest unanswered context call, once per entry in
   * `results`. The plugin awaits each call before issuing the next one, so
   * the replies have to be interleaved with flushes.
   */
  const answerCalls = async (results: unknown[]) => {
    const answered = new Set<number>();
    for (const result of results) {
      await flush();
      const call = port.ofType('context-call').find((c) => !answered.has(c.id));
      if (!call) throw new Error('expected another context call');
      answered.add(call.id);
      port.emit({ type: 'context-result', id: call.id, ok: true, result });
    }
    await flush();
  };

  beforeEach(() => {
    port = new FakePort();
    exit = vi.fn<(code: number) => void>();
    runtime = new PluginHostRuntime(port, exit);
    expect(runtime).toBeDefined();
  });

  it('loads the plugin and reports only function exports', () => {
    init();
    const loaded = port.ofType('loaded');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].exports).toContain('activate');
    expect(loaded[0].exports).toContain('fetchPods');
    expect(loaded[0].exports).not.toContain('someValue');
  });

  it('reports load-error for broken plugin code', () => {
    const brokenDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-broken-'));
    const brokenFile = path.join(brokenDir, 'index.js');
    fs.writeFileSync(brokenFile, 'this is not { valid javascript');
    try {
      port.emit({
        type: 'init',
        pluginId: 'broken',
        pluginPath: brokenDir,
        mainFile: brokenFile,
        permissions: [],
      });
      expect(port.ofType('load-error')).toHaveLength(1);
      expect(port.ofType('loaded')).toHaveLength(0);
    } finally {
      fs.rmSync(brokenDir, { recursive: true, force: true });
    }
  });

  it('invokes hooks with the proxied context and round-trips context calls', async () => {
    init();
    invoke(1, 'activate', true);
    await flush();
    expect(resultFor(1)).toMatchObject({ id: 1, ok: true });

    invoke(2, 'fetchPods');
    await flush();
    const calls = port.ofType('context-call');
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe('kubernetes.getResources');
    expect(calls[0].args).toEqual(['pods', 'default']);

    port.emit({
      type: 'context-result',
      id: calls[0].id,
      ok: true,
      result: [{ name: 'pod-a' }],
    });
    await flush();
    expect(resultFor(2)).toMatchObject({
      id: 2,
      ok: true,
      result: [{ name: 'pod-a' }],
    });
  });

  it('propagates context-call errors back to the plugin', async () => {
    init();
    invoke(1, 'activate', true);
    invoke(2, 'fetchPods');
    await flush();
    const call = port.ofType('context-call')[0];
    port.emit({
      type: 'context-result',
      id: call.id,
      ok: false,
      error: 'cluster unreachable',
    });
    await flush();
    expect(resultFor(2)).toMatchObject({
      id: 2,
      ok: false,
      error: expect.stringContaining('cluster unreachable'),
    });
  });

  it('rejects invocations of missing exports', async () => {
    init();
    invoke(1, 'doesNotExist');
    await flush();
    expect(resultFor(1)).toMatchObject({
      id: 1,
      ok: false,
      error: expect.stringContaining('doesNotExist'),
    });
  });

  it('surfaces plugin exceptions as invoke errors', async () => {
    init();
    invoke(1, 'activate', true);
    invoke(2, 'explode');
    await flush();
    expect(resultFor(2)).toMatchObject({
      id: 2,
      ok: false,
      error: expect.stringContaining('plugin exploded'),
    });
  });

  it('bridges watchResources callbacks and unsubscribes on cleanup', async () => {
    init();
    invoke(1, 'activate', true);
    invoke(2, 'startWatch');
    await flush();

    const watchCall = port
      .ofType('context-call')
      .find((c) => c.path === 'kubernetes.watchResources');
    expect(watchCall).toBeDefined();
    expect(watchCall!.callbacks).toHaveLength(1);
    const cbId = watchCall!.callbacks![0].cbId;

    port.emit({ type: 'callback', cbId, args: [{ kind: 'ADDED' }] });
    invoke(3, 'getReceived');
    await flush();
    expect(resultFor(3)).toMatchObject({
      id: 3,
      ok: true,
      result: [{ kind: 'ADDED' }],
    });

    invoke(4, 'stopWatch');
    await flush();
    expect(port.ofType('unsubscribe')).toEqual([{ type: 'unsubscribe', cbId }]);

    // Events after unsubscribe are dropped
    port.emit({ type: 'callback', cbId, args: [{ kind: 'DELETED' }] });
    invoke(5, 'getReceived');
    await flush();
    expect(resultFor(5)).toMatchObject({
      result: [{ kind: 'ADDED' }],
    });
  });

  it('denies APIs whose permission is missing', async () => {
    init(['kubernetes', 'ui']); // no 'storage'
    invoke(1, 'activate', true);
    invoke(2, 'tryDeniedStorage');
    await flush();
    expect(resultFor(2)).toMatchObject({
      id: 2,
      ok: true,
      result: expect.stringContaining("does not have 'storage' permission"),
    });
  });

  it('deduplicates notifyOnce locally and forwards a single notification', async () => {
    init();
    invoke(1, 'activate', true);
    invoke(2, 'notifyTwice');
    await flush();
    expect(resultFor(2)).toMatchObject({
      id: 2,
      ok: true,
      result: [true, false],
    });
    const notifications = port
      .ofType('context-notify')
      .filter((m) => m.path === 'ui.showNotification');
    expect(notifications).toHaveLength(1);
    expect(notifications[0].args).toEqual(['msg', 'info']);
  });

  it('keeps events.on/emit/off local to the plugin', async () => {
    init();
    invoke(1, 'activate', true);
    invoke(2, 'localEvents');
    await flush();
    expect(resultFor(2)).toMatchObject({
      id: 2,
      ok: true,
      result: ['one'],
    });
  });

  it('forwards logger calls as fire-and-forget notifications', async () => {
    init();
    invoke(1, 'activate', true);
    invoke(2, 'logSomething');
    await flush();
    const logs = port
      .ofType('context-notify')
      .filter((m) => m.path === 'logger.info');
    expect(logs).toHaveLength(1);
    expect(logs[0].args).toEqual(['hello', { detail: 1 }]);
  });

  it('exits on shutdown', () => {
    init();
    port.emit({ type: 'shutdown' });
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('exits the real process by default', () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
    const ownPort = new FakePort();
    new PluginHostRuntime(ownPort);
    ownPort.emit({ type: 'shutdown' });
    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });

  it('turns results that cannot be cloned into strings', async () => {
    init();
    invoke(1, 'activate', true);
    invoke(2, 'circular');
    await flush();
    expect(resultFor(2)).toMatchObject({
      id: 2,
      ok: true,
      result: '[object Object]',
    });
  });

  it('ignores a context result nobody is waiting for', () => {
    init();
    expect(() =>
      port.emit({ type: 'context-result', id: 999, ok: true, result: null })
    ).not.toThrow();
  });

  it('forwards every kubernetes write and exec through context calls', async () => {
    init();
    invoke(1, 'activate', true);
    invoke(2, 'k8sWrites');
    await answerCalls([null, null, null, 'ls output', [{ name: 'pod-a' }]]);

    const calls = port.ofType('context-call').map((c) => [c.path, c.args]);
    expect(calls).toEqual([
      ['kubernetes.createResource', [{ kind: 'ConfigMap' }]],
      [
        'kubernetes.updateResource',
        ['configmaps', 'cm', { kind: 'ConfigMap' }],
      ],
      ['kubernetes.deleteResource', ['configmaps', 'cm', 'default']],
      ['kubernetes.executeCommand', ['pod-a', 'default', 'ls /']],
      ['kubernetes.getPodMetrics', ['default']],
    ]);
    expect(resultFor(2)).toMatchObject({
      ok: true,
      result: [{ name: 'pod-a' }],
    });
  });

  it('forwards UI registrations as notifications and rejects component functions', async () => {
    init();
    invoke(1, 'activate', true);
    invoke(2, 'uiCalls');
    await flush();

    const notified = port.ofType('context-notify').map((m) => [m.path, m.args]);
    expect(notified).toEqual([
      ['ui.registerSidebarItem', [{ id: 'side', label: 'Side' }]],
      ['ui.registerPage', ['/page', 'PageComponent']],
      ['ui.registerResourceAction', ['pods', { id: 'act', label: 'Act' }]],
      ['ui.showNotification', ['hello', 'success']],
      ['ui.openModal', ['modal-id', { a: 1 }]],
    ]);
    expect(resultFor(2)).toMatchObject({
      ok: true,
      result: [
        expect.stringContaining('registerPage: "component" must be a string'),
        expect.stringContaining('openModal: "component" must be a string'),
      ],
    });
  });

  it('proxies the storage API when the permission is granted', async () => {
    init(['kubernetes', 'ui', 'storage']);
    invoke(1, 'activate', true);
    invoke(2, 'storageCalls');
    await answerCalls([null, { v: 1 }, null, null]);

    const calls = port.ofType('context-call').map((c) => [c.path, c.args]);
    expect(calls).toEqual([
      ['storage.set', ['k', { v: 1 }]],
      ['storage.get', ['k']],
      ['storage.delete', ['k']],
      ['storage.clear', []],
    ]);
    expect(resultFor(2)).toMatchObject({ ok: true, result: { v: 1 } });
  });

  it('keeps events.once local and fires it a single time', async () => {
    init();
    invoke(1, 'activate', true);
    invoke(2, 'eventsOnce');
    await flush();
    expect(resultFor(2)).toMatchObject({ ok: true, result: [1] });
  });

  it('broadcasts through main and releases broadcast handlers', async () => {
    init();
    invoke(1, 'activate', true);
    invoke(2, 'broadcasts');
    await flush();

    const broadcast = port
      .ofType('context-notify')
      .find((m) => m.path === 'events.broadcast');
    expect(broadcast?.args).toEqual(['global', 'payload']);

    const subscription = port
      .ofType('context-call')
      .find((c) => c.path === 'events.onBroadcast');
    expect(subscription?.args).toEqual(['global']);
    const cbId = subscription!.callbacks![0].cbId;
    // offBroadcast with the registered handler releases it; an unknown
    // handler is a no-op.
    expect(port.ofType('unsubscribe')).toEqual([{ type: 'unsubscribe', cbId }]);
    expect(resultFor(2)).toMatchObject({ ok: true, result: 'ok' });
  });

  it('subscribes to the cluster and resource lifecycle events', async () => {
    init();
    invoke(1, 'activate', true);
    invoke(2, 'lifecycleSubscriptions');
    await flush();

    const paths = port
      .ofType('context-call')
      .filter((c) => c.path.startsWith('events.on'))
      .map((c) => [c.path, c.args, c.callbacks?.length]);
    expect(paths).toEqual([
      ['events.onClusterConnected', [], 1],
      ['events.onClusterDisconnected', [], 1],
      ['events.onResourceCreated', [], 1],
      ['events.onResourceUpdated', [], 1],
      ['events.onResourceDeleted', [], 1],
    ]);
  });

  it('logs a failed subscription instead of throwing inside the plugin', async () => {
    init();
    invoke(1, 'activate', true);
    invoke(2, 'startWatch');
    await flush();

    const watchCall = port
      .ofType('context-call')
      .find((c) => c.path === 'kubernetes.watchResources');
    port.emit({
      type: 'context-result',
      id: watchCall!.id,
      ok: false,
      error: 'watch refused',
    });
    await flush();

    const errors = port
      .ofType('context-notify')
      .filter((m) => m.path === 'logger.error');
    expect(errors).toEqual([
      {
        type: 'context-notify',
        path: 'logger.error',
        args: ['kubernetes.watchResources failed: watch refused'],
      },
    ]);
    expect(resultFor(2)).toMatchObject({ ok: true, result: 'started' });
  });
});
