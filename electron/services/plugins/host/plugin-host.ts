/**
 * Plugin Host (utility process entry)
 *
 * Runs a single plugin's Node entry (index.js) outside the Electron main
 * process. The plugin code still executes inside the `vm` sandbox (defense in
 * depth), but any crash, hang, or vm escape is now confined to this disposable
 * process: it has no access to Electron internals, app memory, or sessions.
 *
 * The PluginContext handed to the plugin here is a proxy: every privileged
 * operation is forwarded to the main process over `process.parentPort`, where
 * the real, permission-enforcing context executes it.
 */

import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import { executeInSandbox } from '../plugin-sandbox';
import {
  KUBERNETES_METHOD_PERMISSION,
  assertPluginPermission,
} from '../plugin-permissions';
import type {
  CallbackRef,
  HostMessagePort,
  HostToMainMessage,
  MainToHostMessage,
} from './host-protocol';
import type {
  EventsAPI,
  KubernetesAPI,
  LoggerAPI,
  PluginContext,
  StorageAPI,
  UIAPI,
} from '../../../types/plugin-types';

const DEFAULT_NOTIFY_COOLDOWN_MS = 30 * 60 * 1000;

type NotificationType = 'success' | 'error' | 'info' | 'warning';

/** Best-effort conversion to a structured-cloneable value. */
function toCloneable(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Mirrors main's createDeniedAPI: every property throws on call. */
function createDeniedAPI(apiName: string): object {
  return new Proxy(
    {},
    {
      get: () => () => {
        throw new Error(
          `Permission denied: Plugin does not have '${apiName}' permission`
        );
      },
    }
  );
}

/**
 * Host-side runtime. Extracted from the process entry so unit tests can drive
 * it with a fake port.
 */
export class PluginHostRuntime {
  private port: HostMessagePort<HostToMainMessage, MainToHostMessage>;
  private exit: (code: number) => void;

  private pluginId = '';
  private moduleExports: Record<string, unknown> | null = null;
  private context: PluginContext | null = null;

  private nextCallId = 1;
  private nextCbId = 1;
  private pendingCalls = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private callbacks = new Map<number, (...args: unknown[]) => void>();
  /** Reverse lookup so offBroadcast can find the cbId of a handler. */
  private handlerIds = new Map<(...args: unknown[]) => void, number>();

  constructor(
    port: HostMessagePort<HostToMainMessage, MainToHostMessage>,
    exit: (code: number) => void = (code) => process.exit(code)
  ) {
    this.port = port;
    this.exit = exit;
    port.onMessage((message) => this.handleMessage(message));
  }

  handleMessage(message: MainToHostMessage): void {
    switch (message.type) {
      case 'init':
        this.handleInit(message);
        break;
      case 'invoke':
        void this.handleInvoke(message);
        break;
      case 'callback': {
        const fn = this.callbacks.get(message.cbId);
        if (fn) fn(...message.args);
        break;
      }
      case 'context-result': {
        const pending = this.pendingCalls.get(message.id);
        if (!pending) break;
        this.pendingCalls.delete(message.id);
        if (message.ok) pending.resolve(message.result);
        else pending.reject(new Error(message.error ?? 'Unknown error'));
        break;
      }
      case 'shutdown':
        this.exit(0);
        break;
    }
  }

  private handleInit(
    message: Extract<MainToHostMessage, { type: 'init' }>
  ): void {
    this.pluginId = message.pluginId;
    this.context = this.buildContext(
      message.pluginId,
      message.pluginPath,
      message.permissions
    );

    try {
      const code = readFileSync(message.mainFile, 'utf8');
      const moduleCache = new Map<string, unknown>();
      this.moduleExports = executeInSandbox(
        code,
        message.mainFile,
        message.pluginPath,
        moduleCache
      ) as Record<string, unknown>;
      const exportsRecord = this.moduleExports ?? {};
      this.port.postMessage({
        type: 'loaded',
        exports: Object.keys(exportsRecord).filter(
          (name) => typeof exportsRecord[name] === 'function'
        ),
      });
    } catch (error: unknown) {
      this.port.postMessage({ type: 'load-error', error: errorMessage(error) });
    }
  }

  private async handleInvoke(
    message: Extract<MainToHostMessage, { type: 'invoke' }>
  ): Promise<void> {
    const reply = (ok: boolean, result?: unknown, error?: string): void => {
      this.port.postMessage({
        type: 'invoke-result',
        id: message.id,
        ok,
        result,
        error,
      });
    };

    const target = this.moduleExports?.[message.name];
    if (typeof target !== 'function') {
      reply(false, undefined, `Export "${message.name}" is not a function`);
      return;
    }

    try {
      const args = message.withContext ? [this.context] : message.args;
      const result = await (target as (...a: unknown[]) => unknown)(...args);
      reply(true, toCloneable(result));
    } catch (error: unknown) {
      reply(false, undefined, errorMessage(error));
    }
  }

  /** Request/response context call to the main process. */
  private request(
    path: string,
    args: unknown[],
    callbacks?: CallbackRef[]
  ): Promise<unknown> {
    const id = this.nextCallId++;
    return new Promise((resolve, reject) => {
      this.pendingCalls.set(id, { resolve, reject });
      this.port.postMessage({
        type: 'context-call',
        id,
        path,
        args: args.map(toCloneable),
        callbacks,
      });
    });
  }

  /** Fire-and-forget context call. */
  private notify(path: string, args: unknown[]): void {
    this.port.postMessage({
      type: 'context-notify',
      path,
      args: args.map(toCloneable),
    });
  }

  /** Register a local callback and return its descriptor id. */
  private registerCallback(fn: (...args: unknown[]) => void): number {
    const cbId = this.nextCbId++;
    this.callbacks.set(cbId, fn);
    this.handlerIds.set(fn, cbId);
    return cbId;
  }

  private releaseCallback(cbId: number): void {
    const fn = this.callbacks.get(cbId);
    this.callbacks.delete(cbId);
    if (fn) this.handlerIds.delete(fn);
    this.port.postMessage({ type: 'unsubscribe', cbId });
  }

  /** Subscribe-style call: register handler, forward to main, no return value. */
  private subscribe(
    path: string,
    args: unknown[],
    handler: (...a: unknown[]) => void
  ): number {
    const cbId = this.registerCallback(handler);
    // The utility process has no logger of its own; the main process logs
    // what arrives on the logger.* channel under the plugin's id.
    void this.request(path, args, [{ index: args.length, cbId }]).catch(
      (error: unknown) => {
        this.notify('logger.error', [`${path} failed: ${errorMessage(error)}`]);
      }
    );
    return cbId;
  }

  private buildContext(
    pluginId: string,
    pluginPath: string,
    permissions: string[]
  ): PluginContext {
    return {
      pluginId,
      pluginPath,
      kubernetes: this.buildKubernetesAPI(permissions),
      ui: this.buildUIAPI(permissions),
      storage: this.buildStorageAPI(permissions),
      logger: this.buildLoggerAPI(),
      events: this.buildEventsAPI(),
    };
  }

  private buildKubernetesAPI(permissions: string[]): KubernetesAPI {
    // Main enforces the same gate on every forwarded call (and redacts
    // Secrets); checking here too gives the plugin a synchronous error
    // without a round trip.
    const gate = (method: keyof KubernetesAPI): void =>
      assertPluginPermission(
        permissions,
        KUBERNETES_METHOD_PERMISSION[method],
        method
      );
    return {
      getResources: (type, namespace) => {
        gate('getResources');
        return this.request('kubernetes.getResources', [
          type,
          namespace,
        ]) as Promise<unknown[]>;
      },
      createResource: (manifest) => {
        gate('createResource');
        return this.request('kubernetes.createResource', [
          manifest,
        ]) as Promise<void>;
      },
      updateResource: (type, name, manifest) => {
        gate('updateResource');
        return this.request('kubernetes.updateResource', [
          type,
          name,
          manifest,
        ]) as Promise<void>;
      },
      deleteResource: (type, name, namespace) => {
        gate('deleteResource');
        return this.request('kubernetes.deleteResource', [
          type,
          name,
          namespace,
        ]) as Promise<void>;
      },
      executeCommand: (pod, namespace, command) => {
        gate('executeCommand');
        return this.request('kubernetes.executeCommand', [
          pod,
          namespace,
          command,
        ]) as Promise<string>;
      },
      getPodMetrics: (namespace) => {
        gate('getPodMetrics');
        return this.request('kubernetes.getPodMetrics', [namespace]) as Promise<
          Array<{
            namespace: string;
            name: string;
            cpuMillicores: number;
            memoryMi: number;
          }>
        >;
      },
      watchResources: (type, callback) => {
        gate('watchResources');
        const cbId = this.subscribe(
          'kubernetes.watchResources',
          [type],
          (event) => callback(event)
        );
        return () => this.releaseCallback(cbId);
      },
    };
  }

  private buildUIAPI(permissions: string[]): UIAPI {
    if (!permissions.includes('ui')) {
      return createDeniedAPI('ui') as UIAPI;
    }
    // Per-process notifyOnce ledger; resets on plugin reload exactly like the
    // per-context ledger in the in-process implementation.
    const notifiedAt = new Map<string, number>();
    return {
      registerSidebarItem: (item) =>
        this.notify('ui.registerSidebarItem', [item]),
      registerPage: (route, component) => {
        if (typeof component !== 'string') {
          throw new Error(
            `[PluginContext] registerPage: "component" must be a string ` +
              `(renderer module path or export name), not ${typeof component}. ` +
              `UI components must live in the plugin's renderer entry file.`
          );
        }
        this.notify('ui.registerPage', [route, component]);
      },
      registerResourceAction: (resourceType, action) =>
        this.notify('ui.registerResourceAction', [resourceType, action]),
      showNotification: (message, type) =>
        this.notify('ui.showNotification', [message, type]),
      notifyOnce: (
        key: string,
        message: string,
        type: NotificationType,
        cooldownMs: number = DEFAULT_NOTIFY_COOLDOWN_MS
      ): boolean => {
        const now = Date.now();
        const last = notifiedAt.get(key) ?? 0;
        if (now - last < cooldownMs) return false;
        notifiedAt.set(key, now);
        this.notify('ui.showNotification', [message, type]);
        return true;
      },
      openModal: (component, props) => {
        if (typeof component !== 'string') {
          throw new Error(
            `[PluginContext] openModal: "component" must be a string (modal ID registered via pluginUIRegistry.registerModal), not ${typeof component}.`
          );
        }
        this.notify('ui.openModal', [component, props]);
      },
    };
  }

  private buildStorageAPI(permissions: string[]): StorageAPI {
    if (!permissions.includes('storage')) {
      return createDeniedAPI('storage') as StorageAPI;
    }
    return {
      get: <T = unknown>(key: string) =>
        this.request('storage.get', [key]) as Promise<T | null>,
      set: <T = unknown>(key: string, value: T) =>
        this.request('storage.set', [key, value]) as Promise<void>,
      delete: (key) => this.request('storage.delete', [key]) as Promise<void>,
      clear: () => this.request('storage.clear', []) as Promise<void>,
    };
  }

  private buildLoggerAPI(): LoggerAPI {
    const forward =
      (level: 'info' | 'warn' | 'error' | 'debug') =>
      (message: string, ...args: unknown[]): void =>
        this.notify(`logger.${level}`, [message, ...args]);
    return {
      info: forward('info'),
      warn: forward('warn'),
      error: forward('error'),
      debug: forward('debug'),
    };
  }

  private buildEventsAPI(): EventsAPI {
    // on/once/off/emit are plugin-local, exactly like the per-context
    // EventEmitter in the in-process implementation.
    const emitter = new EventEmitter();
    return {
      on: (event, handler) => emitter.on(event, handler),
      once: (event, handler) => emitter.once(event, handler),
      off: (event, handler) => emitter.off(event, handler),
      emit: (event, ...args) => {
        emitter.emit(event, ...args);
      },
      broadcast: (event, ...args) =>
        this.notify('events.broadcast', [event, ...args]),
      onBroadcast: (event, handler) => {
        this.subscribe('events.onBroadcast', [event], handler);
      },
      offBroadcast: (_event, handler) => {
        const cbId = this.handlerIds.get(handler);
        if (cbId !== undefined) this.releaseCallback(cbId);
      },
      onClusterConnected: (handler) => {
        this.subscribe('events.onClusterConnected', [], handler);
      },
      onClusterDisconnected: (handler) => {
        this.subscribe('events.onClusterDisconnected', [], handler);
      },
      onResourceCreated: (handler) => {
        this.subscribe('events.onResourceCreated', [], handler);
      },
      onResourceUpdated: (handler) => {
        this.subscribe('events.onResourceUpdated', [], handler);
      },
      onResourceDeleted: (handler) => {
        this.subscribe('events.onResourceDeleted', [], handler);
      },
    };
  }
}

/* c8 ignore start -- executed only inside a real Electron utility process */
if (process.parentPort) {
  const parentPort = process.parentPort;
  new PluginHostRuntime({
    postMessage: (message) => parentPort.postMessage(message),
    onMessage: (listener) =>
      parentPort.on('message', (event) =>
        listener(event.data as MainToHostMessage)
      ),
  });
}
/* c8 ignore stop */
