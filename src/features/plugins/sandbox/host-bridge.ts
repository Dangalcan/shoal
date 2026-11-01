/**
 * Plugin Host Bridge
 *
 * Runs in the HOST renderer. Owns one plugin iframe's MessagePort, enforces
 * the permission gate, and routes allowed calls to the real host capability
 * layer (`invoke`, wired to `window.electron`). The iframe never touches
 * `window.electron` directly.
 *
 * Kept free of DOM/Electron specifics (the port and `invoke` are injected) so
 * the security-critical dispatch logic is unit-testable.
 */

import {
  METHOD_TABLE,
  isHostboundMessage,
  type MethodSpec,
  type PluginPermission,
  type HostboundMessage,
  type PluginboundMessage,
} from './protocol';
import { permissionDeniedMessage } from '../../../../electron/shared/plugin-permissions';
import {
  withoutSecretDataInList,
  withoutSecretDataInYaml,
} from '../../../../electron/shared/secret-redaction';

/** Minimal structural view of a MessagePort (real or faked in tests). */
export interface PortLike {
  postMessage(message: unknown): void;
  start?(): void;
  close?(): void;
  onmessage: ((ev: { data: unknown }) => void) | null;
}

export interface HostBridgeConfig {
  pluginId: string;
  permissions: Set<PluginPermission>;
  /**
   * Invoke the underlying host capability for an allowlisted method. Called
   * ONLY after the permission gate passes. For settings methods the plugin's
   * own id has already been prepended to `args`.
   */
  invoke: (method: string, args: unknown[]) => Promise<unknown>;
  onReady?: () => void;
  onResize?: (height: number) => void;
  onTitle?: (title: string) => void;
  onNotification?: (message: string, type: string) => void;
  /** Plugin asked to open a registered modal (already `ui`-permission gated). */
  onOpenModal?: (modalId: string, props: unknown) => void;
  /** Plugin asked to close its open modal. */
  onCloseModal?: () => void;
}

export class PluginHostBridge {
  private disposed = false;

  constructor(
    private readonly port: PortLike,
    private readonly config: HostBridgeConfig
  ) {}

  /** Begin listening for messages from the plugin frame. */
  start(): void {
    this.port.onmessage = (ev) => this.handleMessage(ev.data);
    this.port.start?.();
  }

  /** Push a host event down to the plugin frame (e.g. resource:created). */
  dispatchEvent(name: string, payload: unknown): void {
    if (this.disposed) return;
    const msg: PluginboundMessage = { kind: 'event', name, payload };
    this.port.postMessage(msg);
  }

  dispose(): void {
    this.disposed = true;
    this.port.onmessage = null;
    this.port.close?.();
  }

  private handleMessage(data: unknown): void {
    if (!isHostboundMessage(data)) return;
    const msg = data as HostboundMessage;

    if (msg.kind === 'ui') {
      this.handleUiSignal(msg);
      return;
    }
    // rpc-request
    void this.handleRpc(msg.id, msg.method, msg.args ?? []);
  }

  private handleUiSignal(msg: Extract<HostboundMessage, { kind: 'ui' }>): void {
    switch (msg.type) {
      case 'ready':
        this.config.onReady?.();
        break;
      case 'resize':
        this.config.onResize?.(msg.height);
        break;
      case 'title':
        this.config.onTitle?.(msg.title);
        break;
      case 'open-modal':
        // Opening a modal is a UI capability — gate it like ui.* methods.
        if (!this.config.permissions.has('ui')) {
          this.config.onNotification?.(
            'Plugin tried to open a modal without the "ui" permission',
            'error'
          );
          return;
        }
        this.config.onOpenModal?.(msg.modalId, msg.props);
        break;
      case 'close-modal':
        this.config.onCloseModal?.();
        break;
    }
  }

  private async handleRpc(
    id: number,
    method: string,
    args: unknown[]
  ): Promise<void> {
    try {
      const result = await this.authorizeAndInvoke(method, args);
      this.respond({ kind: 'rpc-response', id, ok: true, result });
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      this.respond({ kind: 'rpc-response', id, ok: false, error });
    }
  }

  /** The permission gate + routing. Throws on any violation. */
  private async authorizeAndInvoke(
    method: string,
    args: unknown[]
  ): Promise<unknown> {
    const spec = Object.prototype.hasOwnProperty.call(METHOD_TABLE, method)
      ? METHOD_TABLE[method]
      : undefined;

    if (!spec) {
      throw new Error(`Method not allowed: "${method}"`);
    }

    if (
      spec.permission !== null &&
      !this.config.permissions.has(spec.permission)
    ) {
      throw new Error(permissionDeniedMessage(method, spec.permission));
    }

    // Special-case: notifications are handled entirely host-side.
    if (spec.hostLocal && method === 'ui.showNotification') {
      const [message, type] = args as [string, string];
      this.config.onNotification?.(
        String(message ?? ''),
        String(type ?? 'info')
      );
      return undefined;
    }

    const finalArgs = spec.injectsPluginId
      ? [this.config.pluginId, ...args]
      : args;

    return this.redactSecrets(
      spec,
      await this.config.invoke(method, finalArgs)
    );
  }

  /** Strip Secret payloads from a result unless the plugin holds `secrets`. */
  private redactSecrets(spec: MethodSpec, result: unknown): unknown {
    if (!spec.secretData || this.config.permissions.has('secrets')) {
      return result;
    }
    return spec.secretData === 'yaml'
      ? withoutSecretDataInYaml(result)
      : withoutSecretDataInList(result);
  }

  private respond(msg: PluginboundMessage): void {
    if (this.disposed) return;
    this.port.postMessage(msg);
  }
}
