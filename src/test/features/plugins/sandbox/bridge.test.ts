import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginHostBridge } from '../../../../features/plugins/sandbox/host-bridge';
import type { PortLike } from '../../../../features/plugins/sandbox/host-bridge';
import { createPluginSdk } from '../../../../features/plugins/sandbox/plugin-sdk';
import type { PluginPermission } from '../../../../features/plugins/sandbox/protocol';

/**
 * A pair of in-memory ports wired to each other, delivering messages
 * asynchronously (microtask) to mimic a real MessageChannel.
 */
function linkedPorts(): [PortLike & { emit(m: unknown): void }, PortLike] {
  const a: PortLike = {
    onmessage: null,
    postMessage: () => {},
    start: () => {},
  };
  const b: PortLike = {
    onmessage: null,
    postMessage: () => {},
    start: () => {},
  };
  a.postMessage = (m) => queueMicrotask(() => b.onmessage?.({ data: m }));
  b.postMessage = (m) => queueMicrotask(() => a.onmessage?.({ data: m }));
  return [
    Object.assign(a, { emit: (m: unknown) => a.onmessage?.({ data: m }) }),
    b,
  ];
}

function setup(permissions: PluginPermission[]) {
  const [hostPort, framePort] = linkedPorts();
  const invoke = vi.fn(async (_method: string, _args: unknown[]) => 'RESULT');
  const onNotification = vi.fn();
  const onReady = vi.fn();
  const onResize = vi.fn();
  const onTitle = vi.fn();

  const bridge = new PluginHostBridge(hostPort, {
    pluginId: 'my-plugin',
    permissions: new Set(permissions),
    invoke,
    onNotification,
    onReady,
    onResize,
    onTitle,
  });
  bridge.start();

  const sdk = createPluginSdk(framePort);
  return { bridge, sdk, invoke, onNotification, onReady, onResize, onTitle };
}

describe('plugin sandbox bridge + sdk', () => {
  beforeEach(() => vi.clearAllMocks());

  it('routes an allowed kubernetes call to invoke and resolves', async () => {
    const { sdk, invoke } = setup(['kubernetes']);
    const result = await sdk.kubernetes.getResources({
      contextName: 'ctx',
      resourceType: 'pods',
      namespace: 'default',
    });
    expect(result).toBe('RESULT');
    expect(invoke).toHaveBeenCalledWith('kubernetes.getResources', [
      { contextName: 'ctx', resourceType: 'pods', namespace: 'default' },
    ]);
  });

  it('denies a kubernetes call when the permission is missing', async () => {
    const { sdk, invoke } = setup(['ui']);
    await expect(sdk.kubernetes.getPods('ctx')).rejects.toThrow(
      /Permission denied.*kubernetes/
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it('denies a ui call when the permission is missing', async () => {
    const { sdk, invoke } = setup(['kubernetes']);
    await expect(sdk.ui.openExternal('https://example.com')).rejects.toThrow(
      /Permission denied.*ui/
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it('injects the plugin id for settings and needs no permission', async () => {
    const { sdk, invoke } = setup([]); // no permissions at all
    await sdk.settings.get();
    expect(invoke).toHaveBeenCalledWith('settings.get', ['my-plugin']);

    await sdk.settings.set({ theme: 'dark' });
    expect(invoke).toHaveBeenCalledWith('settings.set', [
      'my-plugin',
      { theme: 'dark' },
    ]);
  });

  it('handles notifications host-side without calling invoke', async () => {
    const { sdk, invoke, onNotification } = setup(['ui']);
    await sdk.ui.showNotification('hello', 'success');
    expect(onNotification).toHaveBeenCalledWith('hello', 'success');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('rejects methods that are not on the allowlist', async () => {
    const { bridge, invoke } = setup(['kubernetes', 'ui', 'storage']);
    // Bypass the typed SDK to simulate a hostile frame.
    const [hostPort, framePort] = linkedPorts();
    const rogue = new PluginHostBridge(hostPort, {
      pluginId: 'x',
      permissions: new Set<PluginPermission>(['kubernetes']),
      invoke,
    });
    rogue.start();
    const replies: unknown[] = [];
    framePort.onmessage = (ev) => replies.push(ev.data);
    framePort.postMessage({
      kind: 'rpc-request',
      id: 7,
      method: 'process.exit',
      args: [],
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(replies).toEqual([
      {
        kind: 'rpc-response',
        id: 7,
        ok: false,
        error: expect.stringContaining('Method not allowed'),
      },
    ]);
    expect(invoke).not.toHaveBeenCalled();
    bridge.dispose();
    rogue.dispose();
  });

  it('propagates invoke errors back to the caller', async () => {
    const { sdk, invoke } = setup(['kubernetes']);
    invoke.mockRejectedValueOnce(new Error('kubectl blew up'));
    await expect(sdk.kubernetes.getClusters()).rejects.toThrow(
      'kubectl blew up'
    );
  });

  it('delivers host events to frame subscribers', async () => {
    const { bridge, sdk } = setup(['kubernetes']);
    const handler = vi.fn();
    sdk.events.on('resource:created', handler);
    bridge.dispatchEvent('resource:created', { name: 'pod-1' });
    await new Promise((r) => setTimeout(r, 0));
    expect(handler).toHaveBeenCalledWith({ name: 'pod-1' });
  });

  it('forwards ui signals (ready, resize, title) to host callbacks', async () => {
    const { sdk, onReady, onResize, onTitle } = setup([]);
    sdk.ready();
    sdk.ui.setHeight(480);
    sdk.ui.setTitle('My Plugin');
    await new Promise((r) => setTimeout(r, 0));
    expect(onReady).toHaveBeenCalled();
    expect(onResize).toHaveBeenCalledWith(480);
    expect(onTitle).toHaveBeenCalledWith('My Plugin');
  });
});
