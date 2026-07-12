/**
 * Plugin SDK (iframe side)
 *
 * Runs INSIDE a plugin's sandboxed iframe. Provides `window.k8sPlugin`: a
 * promise-based, permission-gated API backed by a MessagePort to the host.
 * The iframe has no `window.electron`; this is the plugin's entire capability
 * surface.
 *
 * Pure aside from the injected port, so it is unit-testable.
 */

import {
  isPluginboundMessage,
  type HostboundMessage,
  type PluginboundMessage,
} from './protocol';

export interface SdkPortLike {
  postMessage(message: unknown): void;
  start?(): void;
  onmessage: ((ev: { data: unknown }) => void) | null;
}

type EventHandler = (payload: unknown) => void;

export interface K8sPluginSdk {
  kubernetes: {
    getResources(args: {
      contextName: string;
      resourceType: string;
      namespace: string;
    }): Promise<unknown>;
    getPods(contextName: string): Promise<unknown>;
    getNamespaces(contextName: string): Promise<unknown>;
    getLogs(args: {
      contextName: string;
      podName: string;
      namespace: string;
      tailLines?: number;
    }): Promise<unknown>;
    describeResource(args: unknown): Promise<unknown>;
    getResourceYaml(args: unknown): Promise<unknown>;
    deleteResource(args: unknown): Promise<unknown>;
    getCurrentContext(): Promise<unknown>;
    getClusters(): Promise<unknown>;
  };
  manifests: {
    apply(id: number): Promise<unknown>;
    save(manifest: Record<string, unknown>): Promise<unknown>;
  };
  settings: {
    get(): Promise<unknown>;
    set(settings: Record<string, unknown>): Promise<unknown>;
  };
  ui: {
    openExternal(url: string): Promise<unknown>;
    showNotification(
      message: string,
      type?: 'success' | 'error' | 'info' | 'warning'
    ): Promise<unknown>;
    /** Report the plugin's content height so the host can size the iframe. */
    setHeight(height: number): void;
    /** Set the host page title for this plugin view. */
    setTitle(title: string): void;
    /**
     * Open one of the plugin's registered modals (by id) in a host overlay.
     * `props` must be structured-cloneable (data only) — it is delivered to the
     * modal, which renders in its own sandboxed iframe. Requires `ui`.
     */
    showModal(modalId: string, props?: unknown): void;
    /** Close the plugin's currently open modal. */
    closeModal(): void;
  };
  events: {
    on(name: string, handler: EventHandler): () => void;
  };
  /** Signal the host that the plugin has mounted and is ready. */
  ready(): void;
}

/**
 * Build the SDK object around a MessagePort. Attaches the port's message
 * handler for RPC responses and host events.
 */
export function createPluginSdk(port: SdkPortLike): K8sPluginSdk {
  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  const eventHandlers = new Map<string, Set<EventHandler>>();

  port.onmessage = (ev) => {
    if (!isPluginboundMessage(ev.data)) return;
    const msg = ev.data as PluginboundMessage;

    if (msg.kind === 'rpc-response') {
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.ok) entry.resolve(msg.result);
      else entry.reject(new Error(msg.error));
      return;
    }

    // host event
    const handlers = eventHandlers.get(msg.name);
    if (handlers) {
      for (const h of handlers) h(msg.payload);
    }
  };
  port.start?.();

  function call(method: string, ...args: unknown[]): Promise<unknown> {
    const id = nextId++;
    const request: HostboundMessage = {
      kind: 'rpc-request',
      id,
      method,
      args,
    };
    return new Promise<unknown>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      port.postMessage(request);
    });
  }

  function signal(msg: HostboundMessage): void {
    port.postMessage(msg);
  }

  return {
    kubernetes: {
      getResources: (args) => call('kubernetes.getResources', args),
      getPods: (contextName) => call('kubernetes.getPods', contextName),
      getNamespaces: (contextName) =>
        call('kubernetes.getNamespaces', contextName),
      getLogs: (args) => call('kubernetes.getLogs', args),
      describeResource: (args) => call('kubernetes.describeResource', args),
      getResourceYaml: (args) => call('kubernetes.getResourceYaml', args),
      deleteResource: (args) => call('kubernetes.deleteResource', args),
      getCurrentContext: () => call('kubernetes.getCurrentContext'),
      getClusters: () => call('kubernetes.getClusters'),
    },
    manifests: {
      apply: (id) => call('manifests.apply', id),
      save: (manifest) => call('manifests.save', manifest),
    },
    settings: {
      get: () => call('settings.get'),
      set: (settings) => call('settings.set', settings),
    },
    ui: {
      openExternal: (url) => call('ui.openExternal', url),
      showNotification: (message, type = 'info') =>
        call('ui.showNotification', message, type),
      setHeight: (height) => signal({ kind: 'ui', type: 'resize', height }),
      setTitle: (title) => signal({ kind: 'ui', type: 'title', title }),
      showModal: (modalId, props) =>
        signal({ kind: 'ui', type: 'open-modal', modalId, props }),
      closeModal: () => signal({ kind: 'ui', type: 'close-modal' }),
    },
    events: {
      on: (name, handler) => {
        let set = eventHandlers.get(name);
        if (!set) {
          set = new Set();
          eventHandlers.set(name, set);
        }
        set.add(handler);
        return () => set!.delete(handler);
      },
    },
    ready: () => signal({ kind: 'ui', type: 'ready' }),
  };
}
