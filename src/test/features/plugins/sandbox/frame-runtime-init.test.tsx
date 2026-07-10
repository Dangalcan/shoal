import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Importing the module installs a single window 'message' listener (the frame
// bootstrap). Because a successful init removes that listener, the happy-path
// init must be the LAST dispatch in this file; the guard cases run first while
// the listener is still attached.
import '../../../../features/plugins/sandbox/frame-runtime';

const PLUGIN_PORT_INIT = 'k8s-plugin-port-init';

function dispatchInit(
  data: Record<string, unknown>,
  ports?: MessagePort[]
): void {
  window.dispatchEvent(
    new MessageEvent('message', { data, ports: ports ?? [] })
  );
}

describe('frame-runtime bootstrap message handler', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    document.head.innerHTML = '';
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('ignores non-init messages', () => {
    dispatchInit({ type: 'something-else' });
    // Nothing wired onto the window globals yet.
    expect(
      (window as unknown as { k8sPlugin?: unknown }).k8sPlugin
    ).toBeUndefined();
  });

  it('ignores an init message that carries no port', () => {
    dispatchInit({ type: PLUGIN_PORT_INIT });
    expect(
      (window as unknown as { k8sPlugin?: unknown }).k8sPlugin
    ).toBeUndefined();
  });

  it('bootstraps globals, applies theme + host styles, and injects the entry script', () => {
    const channel = new MessageChannel();
    dispatchInit(
      {
        type: PLUGIN_PORT_INIT,
        pluginId: 'p1',
        entryUrl: 'plugin-file:///p1/renderer.js',
        styleUrls: ['plugin-file:///p1/s.css'],
        view: { kind: 'page' },
        sizing: 'fill',
        hostStyleTexts: ['.x{color:red}'],
        hostStyleHrefs: ['plugin-file:///host/app.css'],
        theme: 'dark',
      },
      [channel.port2]
    );

    const globals = window as unknown as Record<string, unknown>;
    expect(globals.k8sPlugin).toBeDefined();
    expect(globals.electron).toBeDefined();
    expect(globals.React).toBeDefined();
    expect(globals.pluginUIRegistry).toBeDefined();

    // applyHostStyles mirrored the host theme onto this document.
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    // applySizing (fill) + host <style> + plugin entry <script> were injected.
    expect(
      document.querySelector('script[src="plugin-file:///p1/renderer.js"]')
    ).not.toBeNull();
    expect(document.head.querySelectorAll('style').length).toBeGreaterThan(0);
  });
});
