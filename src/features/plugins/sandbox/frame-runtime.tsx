/**
 * Plugin Frame Runtime (bundled, runs INSIDE the sandboxed iframe)
 *
 * Built by `npm run build:plugin-runtime` into public/plugin-host/bootstrap.js
 * (IIFE, offline). It provides the same globals the host used to expose to
 * plugin renderers — React, K8sUI, LucideIcons, pluginUIRegistry — but from
 * within the isolated iframe, so existing plugin UIs run unmodified.
 *
 * Crucially, `window.electron` here is NOT the real IPC bridge: it is a shim
 * backed by `window.k8sPlugin` (MessagePort → PluginHostBridge), so every call
 * still passes the host-side permission gate. The iframe has no direct access
 * to Electron.
 */

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import * as LucideIcons from 'lucide-react';
import * as K8sUI from '../../../components/ui';
import { createPluginSdk, type K8sPluginSdk } from './plugin-sdk';
import type { SdkPortLike } from './plugin-sdk';

const PLUGIN_PORT_INIT = 'k8s-plugin-port-init';

/** Which contribution this frame should mount: the full page, or one widget. */
type FrameView = { kind: 'page' } | { kind: 'widget'; widgetId: string };

interface InitMessage {
  type: string;
  pluginId?: string;
  entryUrl?: string;
  styleUrls?: string[];
  /** What to render in this frame. Defaults to the plugin page. */
  view?: FrameView;
  /** Inline CSS copied from the host <style> tags (dev). */
  hostStyleTexts?: string[];
  /** Stylesheet hrefs copied from the host <link> tags (prod). */
  hostStyleHrefs?: string[];
  /** Host color theme (e.g. "dark") to mirror on this document. */
  theme?: string | null;
}

/** Re-wrap a resolved/rejected SDK call into the { success, data } shape that
 *  legacy plugins expect from `window.electron`. */
function wrapResult<T>(
  p: Promise<T>
): Promise<{ success: boolean; data?: T; error?: string }> {
  return p.then(
    (data) => ({ success: true, data }),
    (err: unknown) => ({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    })
  );
}

/** window.electron shim: the legacy IPC surface, routed through the gated SDK. */
function makeElectronShim(sdk: K8sPluginSdk): Record<string, unknown> {
  return {
    getResources: (a: unknown) => wrapResult(sdk.kubernetes.getResources(a as never)),
    getPods: (c: string) => wrapResult(sdk.kubernetes.getPods(c)),
    getNamespaces: (c: string) => wrapResult(sdk.kubernetes.getNamespaces(c)),
    getLogs: (a: unknown) => wrapResult(sdk.kubernetes.getLogs(a as never)),
    describeResource: (a: unknown) =>
      wrapResult(sdk.kubernetes.describeResource(a)),
    getResourceYaml: (a: unknown) =>
      wrapResult(sdk.kubernetes.getResourceYaml(a)),
    deleteResource: (a: unknown) => wrapResult(sdk.kubernetes.deleteResource(a)),
    getCurrentContext: () => wrapResult(sdk.kubernetes.getCurrentContext()),
    getClusters: () => wrapResult(sdk.kubernetes.getClusters()),
    applyManifest: (id: number) => wrapResult(sdk.manifests.apply(id)),
    saveManifest: (m: Record<string, unknown>) =>
      wrapResult(sdk.manifests.save(m)),
    // Settings are scoped host-side; the plugin's own id is injected there, so
    // the id the plugin passes here is ignored on purpose.
    getPluginSettings: () => wrapResult(sdk.settings.get()),
    setPluginSettings: (_id: string, s: Record<string, unknown>) =>
      wrapResult(sdk.settings.set(s)),
    openExternal: (url: string) => wrapResult(sdk.ui.openExternal(url)),
  };
}

/**
 * pluginUIRegistry shim. A plugin registers its page and any widgets during
 * script execution; this frame mounts only the one contribution requested via
 * `view` (the page, or a specific widget). Both page and widget UIs therefore
 * run in isolated iframes — no plugin code executes in the host realm.
 */
function makeRegistryShim(
  view: FrameView,
  mount: (component: React.ComponentType) => void
): Record<string, unknown> {
  let mounted = false;
  let page: React.ComponentType | null = null;
  const widgets = new Map<string, React.ComponentType>();

  const tryMount = () => {
    if (mounted) return;
    const target =
      view.kind === 'page' ? page : widgets.get(view.widgetId) ?? null;
    if (target) {
      mounted = true;
      mount(target);
    }
  };

  return {
    registerPage: (p: { component?: React.ComponentType }) => {
      if (p && p.component) {
        page = p.component;
        tryMount();
      }
    },
    registerWidget: (w: { id?: string; component?: React.ComponentType }) => {
      if (w && w.id && w.component) {
        widgets.set(w.id, w.component);
        tryMount();
      }
    },
    // Modals/resource-actions are not (yet) supported in the sandbox; accept
    // and ignore so plugins registering them don't throw.
    unregisterWidget: () => {},
    registerModal: () => {},
    unregisterModal: () => {},
    registerResourceAction: () => {},
    unregisterResourceAction: () => {},
    getWidgets: () => [],
    getResourceActions: () => [],
    getPage: () => undefined,
    subscribe: () => () => {},
  };
}

function loadStyles(urls: string[]): void {
  for (const href of urls) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}

/** Reproduce the host app's CSS inside this iframe so plugins look native. */
function applyHostStyles(data: InitMessage): void {
  for (const css of data.hostStyleTexts ?? []) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }
  loadStyles(data.hostStyleHrefs ?? []);
  if (data.theme) {
    document.documentElement.setAttribute('data-theme', data.theme);
  }
}

function loadEntry(entryUrl: string | undefined, sdk: K8sPluginSdk): void {
  if (!entryUrl) return;
  const script = document.createElement('script');
  script.src = entryUrl;
  script.onerror = () =>
    sdk.ui.showNotification('Failed to load plugin UI bundle', 'error');
  document.body.appendChild(script);
}

function observeHeight(sdk: K8sPluginSdk): void {
  const report = () => sdk.ui.setHeight(document.documentElement.scrollHeight);
  report();
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(report).observe(document.documentElement);
  }
}

window.addEventListener('message', function onInit(event: MessageEvent) {
  const data = event.data as InitMessage | undefined;
  if (!data || data.type !== PLUGIN_PORT_INIT) return;
  const port = event.ports && event.ports[0];
  if (!port) return;
  window.removeEventListener('message', onInit);

  const sdk = createPluginSdk(port as unknown as SdkPortLike);
  const container = document.getElementById('root');
  if (!container) return;
  let root: Root | null = null;

  const globals = window as unknown as Record<string, unknown>;
  globals.React = React;
  globals.ReactDOM = {
    createRoot,
    render: (el: React.ReactElement, c: Element) => createRoot(c).render(el),
  };
  globals.K8sUI = K8sUI;
  globals.LucideIcons = LucideIcons;
  globals.k8sPlugin = sdk;
  globals.electron = makeElectronShim(sdk);
  const view: FrameView = data.view ?? { kind: 'page' };
  globals.pluginUIRegistry = makeRegistryShim(view, (Component) => {
    if (!root) root = createRoot(container);
    root.render(React.createElement(Component));
    sdk.ready();
    observeHeight(sdk);
  });

  // Host app CSS first (base look), then the plugin's own styles on top.
  applyHostStyles(data);
  loadStyles(data.styleUrls ?? []);
  loadEntry(data.entryUrl, sdk);
});
