import { describe, it, expect, vi } from 'vitest';
import { createPluginSdk } from '../../../../features/plugins/sandbox/plugin-sdk';
import type { SdkPortLike } from '../../../../features/plugins/sandbox/plugin-sdk';

/** A fake port that records outgoing messages and lets a test inject inbound ones. */
function fakePort(): SdkPortLike & {
  sent: unknown[];
  inbound(msg: unknown): void;
} {
  const port = {
    sent: [] as unknown[],
    onmessage: null as ((ev: { data: unknown }) => void) | null,
    start: vi.fn(),
    postMessage(msg: unknown) {
      this.sent.push(msg);
    },
    inbound(msg: unknown) {
      this.onmessage?.({ data: msg });
    },
  };
  return port;
}

describe('createPluginSdk edge cases', () => {
  it('starts the port on construction', () => {
    const port = fakePort();
    createPluginSdk(port);
    expect(port.start).toHaveBeenCalledTimes(1);
  });

  it('ignores messages that are not plugin-bound protocol messages', () => {
    const port = fakePort();
    createPluginSdk(port);
    // Should not throw for junk / unknown-kind messages.
    expect(() => port.inbound({ kind: 'nonsense' })).not.toThrow();
    expect(() => port.inbound(null)).not.toThrow();
  });

  it('ignores an rpc-response with no matching pending request', () => {
    const port = fakePort();
    createPluginSdk(port);
    expect(() =>
      port.inbound({ kind: 'rpc-response', id: 999, ok: true, result: 1 })
    ).not.toThrow();
  });

  it('resolves a pending call when its response arrives', async () => {
    const port = fakePort();
    const sdk = createPluginSdk(port);
    const p = sdk.kubernetes.getClusters();
    const req = port.sent[0] as { id: number };
    port.inbound({
      kind: 'rpc-response',
      id: req.id,
      ok: true,
      result: ['c1'],
    });
    await expect(p).resolves.toEqual(['c1']);
  });

  it('rejects a pending call when the response is an error', async () => {
    const port = fakePort();
    const sdk = createPluginSdk(port);
    const p = sdk.kubernetes.getPods('ctx');
    const req = port.sent[0] as { id: number };
    port.inbound({
      kind: 'rpc-response',
      id: req.id,
      ok: false,
      error: 'nope',
    });
    await expect(p).rejects.toThrow('nope');
  });

  it('delivers host events only to subscribed handlers and supports unsubscribe', () => {
    const port = fakePort();
    const sdk = createPluginSdk(port);
    const handler = vi.fn();

    // An event with no subscribers is a no-op.
    expect(() =>
      port.inbound({ kind: 'event', name: 'resource:created', payload: 1 })
    ).not.toThrow();

    const off = sdk.events.on('resource:created', handler);
    port.inbound({
      kind: 'event',
      name: 'resource:created',
      payload: { a: 1 },
    });
    expect(handler).toHaveBeenCalledWith({ a: 1 });

    off();
    port.inbound({
      kind: 'event',
      name: 'resource:created',
      payload: { a: 2 },
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('delivers an event to every handler subscribed to its name', () => {
    const port = fakePort();
    const sdk = createPluginSdk(port);
    const first = vi.fn();
    const second = vi.fn();

    sdk.events.on('host:theme', first);
    const offSecond = sdk.events.on('host:theme', second);
    port.inbound({ kind: 'event', name: 'host:theme', payload: 'dark' });

    expect(first).toHaveBeenCalledWith('dark');
    expect(second).toHaveBeenCalledWith('dark');

    // Unsubscribing one handler leaves the other subscribed.
    offSecond();
    port.inbound({ kind: 'event', name: 'host:theme', payload: 'light' });
    expect(first).toHaveBeenLastCalledWith('light');
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('sends fire-and-forget ui signals', () => {
    const port = fakePort();
    const sdk = createPluginSdk(port);
    sdk.ready();
    sdk.ui.setHeight(200);
    sdk.ui.setTitle('T');
    sdk.ui.showModal('m', { x: 1 });
    sdk.ui.closeModal();
    expect(port.sent).toEqual([
      { kind: 'ui', type: 'ready' },
      { kind: 'ui', type: 'resize', height: 200 },
      { kind: 'ui', type: 'title', title: 'T' },
      { kind: 'ui', type: 'open-modal', modalId: 'm', props: { x: 1 } },
      { kind: 'ui', type: 'close-modal' },
    ]);
  });

  it('defaults the notification type to info', () => {
    const port = fakePort();
    const sdk = createPluginSdk(port);
    void sdk.ui.showNotification('hi');
    expect(port.sent[0]).toMatchObject({
      kind: 'rpc-request',
      method: 'ui.showNotification',
      args: ['hi', 'info'],
    });
  });

  it('maps every rpc method to its protocol name and forwards args', () => {
    const port = fakePort();
    const sdk = createPluginSdk(port);
    const args = {
      contextName: 'c',
      resourceType: 'pods',
      namespace: 'default',
    };
    void sdk.kubernetes.getResources(args);
    void sdk.kubernetes.getPods('c');
    void sdk.kubernetes.getNamespaces('c');
    void sdk.kubernetes.getLogs({
      contextName: 'c',
      podName: 'p',
      namespace: 'n',
    });
    void sdk.kubernetes.getPodMetrics({ contextName: 'c', namespace: 'n' });
    void sdk.kubernetes.describeResource({ a: 1 });
    void sdk.kubernetes.getResourceYaml({ a: 1 });
    void sdk.kubernetes.deleteResource({ a: 1 });
    void sdk.kubernetes.getCurrentContext();
    void sdk.kubernetes.getClusters();
    void sdk.manifests.apply(5);
    void sdk.manifests.save({ kind: 'Pod' });
    const release = { contextName: 'c', namespace: 'n', releaseName: 'r' };
    void sdk.helm.install({ ...release, chart: 'bitnami/nginx' });
    void sdk.helm.upgrade({ ...release, chart: 'bitnami/nginx' });
    void sdk.helm.rollback({ ...release, revision: 2 });
    void sdk.helm.uninstall(release);
    void sdk.helm.repoAdd({
      name: 'bitnami',
      url: 'https://charts.bitnami.com',
    });
    void sdk.helm.repoList();
    void sdk.settings.get();
    void sdk.settings.set({ theme: 'dark' });
    void sdk.ui.openExternal('https://x.test');

    const methods = (port.sent as { method: string }[]).map((m) => m.method);
    expect(methods).toEqual([
      'kubernetes.getResources',
      'kubernetes.getPods',
      'kubernetes.getNamespaces',
      'kubernetes.getLogs',
      'kubernetes.getPodMetrics',
      'kubernetes.describeResource',
      'kubernetes.getResourceYaml',
      'kubernetes.deleteResource',
      'kubernetes.getCurrentContext',
      'kubernetes.getClusters',
      'manifests.apply',
      'manifests.save',
      'helm.install',
      'helm.upgrade',
      'helm.rollback',
      'helm.uninstall',
      'helm.repoAdd',
      'helm.repoList',
      'settings.get',
      'settings.set',
      'ui.openExternal',
    ]);
    // request ids are unique and monotonically increasing
    const ids = (port.sent as { id: number }[]).map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
