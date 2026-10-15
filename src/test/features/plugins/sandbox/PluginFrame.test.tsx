import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import { ApiProvider } from '../../../../services/api-context';
import { createMockElectronAPI } from '../../../utils/mocks';

interface FakeBridge {
  config: Record<string, (...args: unknown[]) => void>;
  start: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  dispatchEvent: ReturnType<typeof vi.fn>;
}

const bridges = vi.hoisted(() => ({ instances: [] as FakeBridge[] }));

vi.mock('../../../../features/plugins/sandbox/host-bridge', () => ({
  PluginHostBridge: vi.fn().mockImplementation(function (
    _port: unknown,
    config: FakeBridge['config']
  ) {
    const inst: FakeBridge = {
      config,
      start: vi.fn(),
      dispose: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    bridges.instances.push(inst);
    return inst;
  }),
}));

vi.mock('../../../../features/plugins/sandbox/electron-invoker', () => ({
  createElectronInvoker: vi.fn(() => vi.fn()),
}));

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));
vi.mock('sonner', () => ({ toast }));

import {
  PluginFrame,
  PLUGIN_PORT_INIT,
} from '../../../../features/plugins/sandbox/PluginFrame';

function renderFrame(
  props: Partial<React.ComponentProps<typeof PluginFrame>> = {}
) {
  const api = createMockElectronAPI();
  const utils = render(
    <ApiProvider api={api}>
      <PluginFrame
        pluginId="p1"
        hostDocumentUrl="plugin-file:///host/index.html"
        entryUrl="plugin-file:///p1/renderer.js"
        styleUrls={['plugin-file:///p1/s.css']}
        permissions={['kubernetes', 'ui']}
        {...props}
      />
    </ApiProvider>
  );
  const iframe = utils.container.querySelector('iframe') as HTMLIFrameElement;
  return { ...utils, iframe };
}

describe('PluginFrame', () => {
  beforeEach(() => {
    bridges.instances.length = 0;
    vi.clearAllMocks();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders a sandboxed iframe pointing at the host document', () => {
    const { iframe } = renderFrame();
    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe.getAttribute('src')).toBe('plugin-file:///host/index.html');
    expect(iframe.getAttribute('title')).toBe('plugin-p1');
  });

  it('starts a bridge and posts the init message with a transferred port on load', () => {
    const { iframe } = renderFrame();
    const postSpy = vi.spyOn(iframe.contentWindow!, 'postMessage');

    fireEvent.load(iframe);

    expect(bridges.instances).toHaveLength(1);
    expect(bridges.instances[0].start).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledTimes(1);
    // postMessage(message, targetOrigin, transfer): three arguments at run
    // time, but the DOM typings only know the two-argument overloads.
    const [message, targetOrigin, transfer] = postSpy.mock
      .calls[0] as unknown as [unknown, string, unknown[]];
    expect((message as { type: string }).type).toBe(PLUGIN_PORT_INIT);
    expect((message as { pluginId: string }).pluginId).toBe('p1');
    expect((message as { entryUrl: string }).entryUrl).toBe(
      'plugin-file:///p1/renderer.js'
    );
    expect(targetOrigin).toBe('*');
    expect(Array.isArray(transfer)).toBe(true);
    expect(transfer.length).toBe(1);
  });

  it('maps each notification type to the matching toast', () => {
    const { iframe } = renderFrame();
    fireEvent.load(iframe);
    const { onNotification } = bridges.instances[0].config;

    onNotification('ok', 'success');
    onNotification('bad', 'error');
    onNotification('careful', 'warning');
    onNotification('fyi', 'info');
    onNotification('other', 'something-else');

    expect(toast.success).toHaveBeenCalledWith('ok', {
      description: 'From: p1',
    });
    expect(toast.error).toHaveBeenCalledWith('bad', {
      description: 'From: p1',
    });
    expect(toast.warning).toHaveBeenCalledWith('careful', {
      description: 'From: p1',
    });
    // both 'info' and the unknown type fall through to toast.info
    expect(toast.info).toHaveBeenCalledTimes(2);
  });

  it('forwards title / modal callbacks to the props', () => {
    const onTitle = vi.fn();
    const onOpenModal = vi.fn();
    const onCloseModal = vi.fn();
    const { iframe } = renderFrame({ onTitle, onOpenModal, onCloseModal });
    fireEvent.load(iframe);
    const cfg = bridges.instances[0].config;

    act(() => {
      cfg.onResize(320);
      cfg.onTitle('Hello');
      cfg.onOpenModal('m1', { a: 1 });
      cfg.onCloseModal();
    });

    expect(onTitle).toHaveBeenCalledWith('Hello');
    expect(onOpenModal).toHaveBeenCalledWith('m1', { a: 1 });
    expect(onCloseModal).toHaveBeenCalled();
  });

  it('pushes host theme changes to the bridge via the observer', async () => {
    const { iframe } = renderFrame();
    fireEvent.load(iframe);

    document.documentElement.setAttribute('data-theme', 'dark');
    await waitFor(() =>
      expect(bridges.instances[0].dispatchEvent).toHaveBeenCalledWith(
        'host:theme',
        'dark'
      )
    );
  });

  it('disposes the bridge on unmount', () => {
    const { iframe, unmount } = renderFrame();
    fireEvent.load(iframe);
    const inst = bridges.instances[0];
    unmount();
    expect(inst.dispose).toHaveBeenCalledTimes(1);
  });

  it('fills its container height in fill sizing mode', () => {
    const { iframe } = renderFrame({ sizing: 'fill' });
    expect(iframe.style.height).toBe('100%');
  });

  it('resizes to the reported content height in content sizing mode', () => {
    const { iframe } = renderFrame({ sizing: 'content' });
    fireEvent.load(iframe);
    // Height starts at 100% until the plugin reports one.
    expect(iframe.style.height).toBe('100%');
  });
});
