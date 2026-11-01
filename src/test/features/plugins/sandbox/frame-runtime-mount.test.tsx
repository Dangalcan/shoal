/**
 * Coverage for the frame-runtime bootstrap's mount path: modal onClose
 * injection, legacy ReactDOM.render shim, height observation for content
 * frames, theme events after load, entry-script error handling, and the
 * registry shim's inert compatibility getters.
 *
 * Each test re-imports the module (vi.resetModules) so the single window
 * 'message' listener is fresh per test.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import React from 'react';
import type { ComponentType } from 'react';
import {
  makeRegistryShim,
  type FrameView,
} from '../../../../features/plugins/sandbox/frame-runtime';

const PLUGIN_PORT_INIT = 'k8s-plugin-port-init';

interface HostboundMsg {
  kind: string;
  type?: string;
  method?: string;
  height?: number;
  args?: unknown[];
}

interface TestHarness {
  channel: MessageChannel;
  received: HostboundMsg[];
}

/** Import a fresh frame-runtime and dispatch an init message with a port. */
async function bootFrame(data: Record<string, unknown>): Promise<TestHarness> {
  vi.resetModules();
  await import('../../../../features/plugins/sandbox/frame-runtime');

  const channel = new MessageChannel();
  const received: HostboundMsg[] = [];
  channel.port1.onmessage = (ev) => received.push(ev.data as HostboundMsg);

  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: PLUGIN_PORT_INIT, pluginId: 'p1', ...data },
        ports: [channel.port2],
        // The runtime only takes the port from its parent window; in jsdom
        // the test window is its own parent.
        source: window.parent,
      })
    );
  });

  return { channel, received };
}

type Registry = {
  registerPage: (p: { component?: ComponentType }) => void;
  registerModal: (m: { id?: string; component?: ComponentType }) => void;
  registerWidget: (w: { id?: string; component?: ComponentType }) => void;
};

function registry(): Registry {
  return (window as unknown as { pluginUIRegistry: Registry }).pluginUIRegistry;
}

describe('frame-runtime mount path', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    document.head.innerHTML = '';
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('mounts a modal with host props and an onClose that signals close-modal', async () => {
    const { received } = await bootFrame({
      view: { kind: 'modal', modalId: 'm1' },
      viewProps: { podName: 'p-0' },
    });

    let seenProps: Record<string, unknown> | null = null;
    const ModalC = (props: Record<string, unknown>) => {
      seenProps = props;
      return (
        <button onClick={() => (props.onClose as () => void)()}>close</button>
      );
    };

    act(() => {
      registry().registerModal({ id: 'm1', component: ModalC });
    });

    expect(seenProps).not.toBeNull();
    expect(seenProps!.podName).toBe('p-0');
    expect(typeof seenProps!.onClose).toBe('function');

    act(() => {
      document.querySelector('button')!.click();
    });

    await waitFor(() => {
      expect(received.some((m) => m.type === 'close-modal')).toBe(true);
      expect(received.some((m) => m.type === 'ready')).toBe(true);
    });
  });

  it('reports content height on mount and observes resizes when ResizeObserver exists', async () => {
    const observe = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(public cb: () => void) {}
        observe = observe;
        unobserve = vi.fn();
        disconnect = vi.fn();
      }
    );

    const { received } = await bootFrame({
      view: { kind: 'widget', widgetId: 'w1' },
      sizing: 'content',
    });

    act(() => {
      registry().registerWidget({ id: 'w1', component: () => <div>w</div> });
    });

    await waitFor(() => {
      expect(received.some((m) => m.type === 'resize')).toBe(true);
    });
    expect(observe).toHaveBeenCalledWith(document.documentElement);
  });

  it('updates and clears the document theme from host:theme events', async () => {
    const { channel } = await bootFrame({ view: { kind: 'page' } });

    channel.port1.postMessage({
      kind: 'event',
      name: 'host:theme',
      payload: 'dark',
    });
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    channel.port1.postMessage({
      kind: 'event',
      name: 'host:theme',
      payload: null,
    });
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    });
  });

  it('notifies via the SDK when the entry script fails to load', async () => {
    const { received } = await bootFrame({
      view: { kind: 'page' },
      entryUrl: 'plugin-file:///p1/renderer.js',
    });

    const script = document.querySelector<HTMLScriptElement>(
      'script[src="plugin-file:///p1/renderer.js"]'
    );
    expect(script).not.toBeNull();

    act(() => {
      script!.onerror!(new Event('error'));
    });

    await waitFor(() => {
      expect(
        received.some(
          (m) => m.kind === 'rpc-request' && m.method === 'ui.showNotification'
        )
      ).toBe(true);
    });
  });

  it('mounts the page when the init message names no view', async () => {
    const { received } = await bootFrame({});

    act(() => {
      registry().registerWidget({ id: 'w1', component: () => <div>w</div> });
    });
    expect(document.getElementById('root')!.textContent).toBe('');

    act(() => {
      registry().registerPage({ component: () => <h1>plugin page</h1> });
    });

    expect(document.getElementById('root')!.textContent).toBe('plugin page');
    await waitFor(() => {
      expect(received.some((m) => m.type === 'ready')).toBe(true);
    });
  });

  it('does not report or observe its height for a fill page', async () => {
    const observe = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(public cb: () => void) {}
        observe = observe;
        unobserve = vi.fn();
        disconnect = vi.fn();
      }
    );

    const { received } = await bootFrame({
      view: { kind: 'page' },
      sizing: 'fill',
    });

    act(() => {
      registry().registerPage({ component: () => <div>tall page</div> });
    });

    // Messages on a port arrive in order: the height report would be posted
    // right after 'ready', so once 'ready' is in, a resize would be too.
    await waitFor(() => {
      expect(received.some((m) => m.type === 'ready')).toBe(true);
    });
    expect(received.some((m) => m.type === 'resize')).toBe(false);
    expect(observe).not.toHaveBeenCalled();
  });

  it('wires no plugin globals and loads no entry when the frame has no #root', async () => {
    document.body.innerHTML = '';
    const globals = window as unknown as Record<string, unknown>;
    delete globals.k8sPlugin;
    delete globals.pluginUIRegistry;

    const { channel } = await bootFrame({
      view: { kind: 'page' },
      entryUrl: 'plugin-file:///p1/renderer.js',
      styleUrls: ['plugin-file:///p1/s.css'],
    });

    expect(globals.k8sPlugin).toBeUndefined();
    expect(globals.pluginUIRegistry).toBeUndefined();
    expect(document.querySelector('script')).toBeNull();
    expect(document.head.querySelector('link')).toBeNull();

    // The theme listener is attached before the #root check, so the frame
    // still follows the host theme.
    channel.port1.postMessage({
      kind: 'event',
      name: 'host:theme',
      payload: 'dark',
    });
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  it('exposes a legacy ReactDOM.render that mounts into a container', async () => {
    await bootFrame({ view: { kind: 'page' } });

    const target = document.createElement('div');
    document.body.appendChild(target);
    const legacy = (
      window as unknown as {
        ReactDOM: { render: (el: React.ReactElement, c: Element) => void };
      }
    ).ReactDOM;

    act(() => {
      legacy.render(React.createElement('span', null, 'legacy'), target);
    });

    await waitFor(() => {
      expect(target.textContent).toBe('legacy');
    });
  });
});

describe('registry shim compatibility getters', () => {
  it('exposes inert getters and unregister no-ops for legacy plugins', () => {
    const shim = makeRegistryShim(
      { kind: 'page' } as FrameView,
      undefined,
      vi.fn()
    ) as unknown as {
      getWidgets: () => unknown[];
      getResourceActions: () => unknown[];
      getPage: () => unknown;
      subscribe: () => () => void;
      unregisterWidget: () => void;
      unregisterModal: () => void;
      unregisterResourceAction: () => void;
    };

    expect(shim.getWidgets()).toEqual([]);
    expect(shim.getResourceActions()).toEqual([]);
    expect(shim.getPage()).toBeUndefined();
    const unsubscribe = shim.subscribe();
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
    expect(() => {
      shim.unregisterWidget();
      shim.unregisterModal();
      shim.unregisterResourceAction();
    }).not.toThrow();
  });
});
