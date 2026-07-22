/**
 * Plugin Sandbox Protocol
 *
 * Shared message contract between the host renderer and a plugin's sandboxed
 * iframe. The iframe has NO access to `window.electron`; every capability is
 * mediated by this protocol over a MessageChannel and gated by the plugin's
 * declared permissions.
 *
 * This module is pure (no DOM / Electron imports) so it can be imported by
 * both sides and unit-tested in isolation.
 */

/** Permissions a plugin can declare in its manifest. */
export type PluginPermission = 'kubernetes' | 'ui' | 'storage';

/**
 * The curated, permission-gated method surface exposed to plugin UIs.
 *
 * `permission` is the manifest permission required to call the method, or
 * `null` for methods that only ever act on the plugin's OWN data (e.g. its
 * own settings) and are therefore always allowed.
 *
 * The plugin can never name another plugin: host-injected identity (pluginId)
 * is applied by the bridge, not passed by the plugin.
 */
export interface MethodSpec {
  permission: PluginPermission | null;
  /**
   * When true, the bridge prepends the plugin's own id as the first argument
   * before invoking the underlying host API (used for settings scoping).
   */
  injectsPluginId?: boolean;
  /** When true, the bridge handles this locally (no host API call). */
  hostLocal?: boolean;
}

/**
 * The complete allowlist of methods a sandboxed plugin may invoke. Anything
 * not in this table is rejected by the host bridge. This is the security gate:
 * to expose a new capability, add it here deliberately.
 */
export const METHOD_TABLE: Record<string, MethodSpec> = {
  // Kubernetes (read + limited mutate) — require the `kubernetes` permission.
  'kubernetes.getResources': { permission: 'kubernetes' },
  'kubernetes.getPods': { permission: 'kubernetes' },
  'kubernetes.getNamespaces': { permission: 'kubernetes' },
  'kubernetes.getLogs': { permission: 'kubernetes' },
  'kubernetes.getPodMetrics': { permission: 'kubernetes' },
  'kubernetes.describeResource': { permission: 'kubernetes' },
  'kubernetes.getResourceYaml': { permission: 'kubernetes' },
  'kubernetes.deleteResource': { permission: 'kubernetes' },
  'kubernetes.getCurrentContext': { permission: 'kubernetes' },
  'kubernetes.getClusters': { permission: 'kubernetes' },

  // Manifests — treated as cluster mutation, require `kubernetes`.
  'manifests.apply': { permission: 'kubernetes' },
  'manifests.save': { permission: 'kubernetes' },

  // Helm — cluster mutation via the validated helm service, require `kubernetes`.
  'helm.install': { permission: 'kubernetes' },
  'helm.upgrade': { permission: 'kubernetes' },
  'helm.rollback': { permission: 'kubernetes' },
  'helm.uninstall': { permission: 'kubernetes' },
  'helm.repoAdd': { permission: 'kubernetes' },
  'helm.repoList': { permission: 'kubernetes' },

  // Settings — the plugin's OWN settings only; pluginId is injected by the
  // host so a plugin cannot read or write another plugin's settings.
  'settings.get': { permission: null, injectsPluginId: true },
  'settings.set': { permission: null, injectsPluginId: true },

  // UI — require the `ui` permission.
  'ui.openExternal': { permission: 'ui' },
  'ui.showNotification': { permission: 'ui', hostLocal: true },
};

export type MethodName = keyof typeof METHOD_TABLE;

/** Envelope: plugin iframe → host, requesting a method call. */
export interface RpcRequest {
  kind: 'rpc-request';
  id: number;
  method: string;
  args: unknown[];
}

/** Envelope: host → plugin iframe, the result of a method call. */
export type RpcResponse =
  | { kind: 'rpc-response'; id: number; ok: true; result: unknown }
  | { kind: 'rpc-response'; id: number; ok: false; error: string };

/** Envelope: host → plugin iframe, a fire-and-forget host event. */
export interface HostEvent {
  kind: 'event';
  name: string;
  payload: unknown;
}

/** Envelope: plugin iframe → host, a non-RPC UI signal. */
export type UiSignal =
  | { kind: 'ui'; type: 'ready' }
  | { kind: 'ui'; type: 'resize'; height: number }
  | { kind: 'ui'; type: 'title'; title: string }
  // Ask the host to open one of this plugin's registered modals in an overlay.
  // `props` is structured-cloned across the port (data only, never functions),
  // so no plugin code crosses into the host realm. Requires the `ui` permission.
  | { kind: 'ui'; type: 'open-modal'; modalId: string; props?: unknown }
  // Ask the host to close the plugin's currently open modal overlay.
  | { kind: 'ui'; type: 'close-modal' };

export type HostboundMessage = RpcRequest | UiSignal;
export type PluginboundMessage = RpcResponse | HostEvent;

/** Type guard for messages arriving at the host from a plugin frame. */
export function isHostboundMessage(v: unknown): v is HostboundMessage {
  if (!v || typeof v !== 'object') return false;
  const kind = (v as { kind?: unknown }).kind;
  return kind === 'rpc-request' || kind === 'ui';
}

/** Type guard for messages arriving at a plugin frame from the host. */
export function isPluginboundMessage(v: unknown): v is PluginboundMessage {
  if (!v || typeof v !== 'object') return false;
  const kind = (v as { kind?: unknown }).kind;
  return kind === 'rpc-response' || kind === 'event';
}
