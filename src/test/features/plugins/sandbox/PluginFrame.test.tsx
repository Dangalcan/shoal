import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  const frame = (
    overrides: Partial<React.ComponentProps<typeof PluginFrame>>
  ) => (
    <ApiProvider api={api}>
      <PluginFrame
        pluginId="p1"
        hostDocumentUrl="plugin-file:///host/index.html"
        entryUrl="plugin-file:///p1/renderer.js"
        styleUrls={['plugin-file:///p1/s.css']}
        permissions={['kubernetes', 'ui']}
        {...overrides}
      />
    </ApiProvider>
  );
  const utils = render(frame(props));
  const iframe = utils.container.querySelector('iframe') as HTMLIFrameElement;
  /** Re-render with the same api, so only the given props change. */
  const rerenderFrame = (
    next: Partial<React.ComponentProps<typeof PluginFrame>>
  ) => utils.rerender(frame(next));
  return { ...utils, iframe, rerenderFrame };
}

interface InitMessage {
  type: string;
  view: unknown;
  viewProps: unknown;
  sizing: string;
  hostStyleTexts: string[];
  hostStyleHrefs: string[];
  theme: string | null;
}

/** Fire the iframe load event and return the init message it posted. */
function loadAndCaptureInit(iframe: HTMLIFrameElement): InitMessage {
  const postSpy = vi.spyOn(iframe.contentWindow!, 'postMessage');
  fireEvent.load(iframe);
  expect(postSpy).toHaveBeenCalledTimes(1);
  return postSpy.mock.calls[0][0] as InitMessage;
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

  it('hands only one port to the frame when it fires load more than once', () => {
    const { iframe } = renderFrame();
    const postSpy = vi.spyOn(iframe.contentWindow!, 'postMessage');

    fireEvent.load(iframe);
    fireEvent.load(iframe);

    expect(bridges.instances).toHaveLength(1);
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it('sends the page view, content sizing and current theme by default', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { iframe } = renderFrame();

    const init = loadAndCaptureInit(iframe);

    expect(init.view).toEqual({ kind: 'page' });
    expect(init.viewProps).toBeUndefined();
    expect(init.sizing).toBe('content');
    expect(init.theme).toBe('dark');
  });

  it('sends a widget view to the frame', () => {
    const { iframe } = renderFrame({
      view: { kind: 'widget', widgetId: 'w1' },
    });

    const init = loadAndCaptureInit(iframe);

    expect(init.view).toEqual({ kind: 'widget', widgetId: 'w1' });
    expect(init.theme).toBeNull();
  });

  it('sends a modal view with its props to the frame', () => {
    const { iframe } = renderFrame({
      view: { kind: 'modal', modalId: 'm1' },
      viewProps: { podName: 'p-0' },
    });

    const init = loadAndCaptureInit(iframe);

    expect(init.view).toEqual({ kind: 'modal', modalId: 'm1' });
    expect(init.viewProps).toEqual({ podName: 'p-0' });
  });

  it('re-initialises the frame when the widget id changes', () => {
    const { iframe, rerenderFrame } = renderFrame({
      view: { kind: 'widget', widgetId: 'w1' },
    });
    fireEvent.load(iframe);
    const first = bridges.instances[0];

    rerenderFrame({ view: { kind: 'widget', widgetId: 'w2' } });
    expect(first.dispose).toHaveBeenCalledTimes(1);

    const init = loadAndCaptureInit(iframe);
    expect(bridges.instances).toHaveLength(2);
    expect(init.view).toEqual({ kind: 'widget', widgetId: 'w2' });
  });

  it('re-initialises the frame when the modal id changes', () => {
    const { iframe, rerenderFrame } = renderFrame({
      view: { kind: 'modal', modalId: 'm1' },
    });
    fireEvent.load(iframe);

    rerenderFrame({ view: { kind: 'modal', modalId: 'm2' } });

    expect(bridges.instances[0].dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps the frame when the parent re-renders with equal props', () => {
    const { iframe, rerenderFrame } = renderFrame({
      view: { kind: 'widget', widgetId: 'w1' },
    });
    fireEvent.load(iframe);

    // Fresh arrays and view object with the same contents.
    rerenderFrame({
      view: { kind: 'widget', widgetId: 'w1' },
      permissions: ['kubernetes', 'ui'],
      styleUrls: ['plugin-file:///p1/s.css'],
    });

    expect(bridges.instances).toHaveLength(1);
    expect(bridges.instances[0].dispose).not.toHaveBeenCalled();
  });

  describe('host styles', () => {
    let added: HTMLElement[] = [];

    function addToHead(html: string): void {
      const holder = document.createElement('div');
      holder.innerHTML = html;
      for (const el of Array.from(holder.children)) {
        document.head.appendChild(el);
        added.push(el as HTMLElement);
      }
    }

    afterEach(() => {
      added.forEach((el) => el.remove());
      added = [];
    });

    it('copies non-empty host <style> text into the init message', () => {
      addToHead('<style>.host{color:red}</style><style></style>');
      const { iframe } = renderFrame();

      const init = loadAndCaptureInit(iframe);

      expect(init.hostStyleTexts).toContain('.host{color:red}');
      expect(init.hostStyleTexts).not.toContain('');
    });

    it('copies host stylesheet links, rewriting file: URLs and skipping empty ones', () => {
      addToHead(
        '<link rel="stylesheet" href="file:///opt/shoal/assets/index-abc.css">' +
          '<link rel="stylesheet" href="http://localhost:4173/src/app.css">' +
          '<link rel="stylesheet">'
      );
      const { iframe } = renderFrame();

      const init = loadAndCaptureInit(iframe);

      expect(init.hostStyleHrefs).toContain(
        'plugin-file://local/opt/shoal/assets/index-abc.css'
      );
      expect(init.hostStyleHrefs).toContain(
        'http://localhost:4173/src/app.css'
      );
      expect(init.hostStyleHrefs).not.toContain('');
      expect(init.hostStyleHrefs.some((href) => href.startsWith('file:'))).toBe(
        false
      );
    });
  });

  it('resizes to the reported content height in content sizing mode', () => {
    const { iframe } = renderFrame({ sizing: 'content' });
    fireEvent.load(iframe);
    // Height starts at 100% until the plugin reports one.
    expect(iframe.style.height).toBe('100%');

    act(() => {
      bridges.instances[0].config.onResize(320);
    });
    expect(iframe.style.height).toBe('320px');
  });

  it('keeps filling its container in fill mode even after a height report', () => {
    const { iframe } = renderFrame({ sizing: 'fill' });
    fireEvent.load(iframe);

    act(() => {
      bridges.instances[0].config.onResize(320);
    });
    expect(iframe.style.height).toBe('100%');
  });
});
