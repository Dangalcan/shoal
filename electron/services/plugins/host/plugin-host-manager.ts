/**
 * Plugin Host Manager (main-process side)
 *
 * Spawns one Electron utility process per isolated plugin and routes the RPC
 * protocol defined in host-protocol.ts: context calls from the plugin are
 * executed against the real, permission-enforcing PluginContext here in main;
 * lifecycle hooks and actions are invoked in the utility process.
 */

import path from 'path';
import type {
  CallbackRef,
  HostToMainMessage,
  MainToHostMessage,
} from './host-protocol';
import type { PluginContext } from '../../../types/plugin-types';
import type {
  PluginModuleHandle,
  PluginModuleInvokeOptions,
} from './module-handle';
import { pluginEventBus } from '../plugin-events';
import { getErrorMessage } from '../../../utils/error-utils';
import log from '../../../logger';
import { hostEnvironment } from './host-environment';

const LOAD_TIMEOUT_MS = 15_000;
const INVOKE_TIMEOUT_MS = 30_000;

/** The subset of Electron.UtilityProcess the manager needs (fake-able in tests). */
export interface UtilityProcessLike {
  postMessage(message: unknown): void;
  on(event: 'message', listener: (message: unknown) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
  kill(): unknown;
  stdout?: NodeJS.ReadableStream | null;
  stderr?: NodeJS.ReadableStream | null;
}

export type ForkFn = (
  modulePath: string,
  serviceName: string
) => UtilityProcessLike;

/** Context methods a host process may call, by exact dot-path. */
const ALLOWED_CONTEXT_PATHS = new Set([
  'kubernetes.getResources',
  'kubernetes.createResource',
  'kubernetes.updateResource',
  'kubernetes.deleteResource',
  'kubernetes.executeCommand',
  'kubernetes.getPodMetrics',
  'kubernetes.watchResources',
  'ui.registerSidebarItem',
  'ui.registerPage',
  'ui.registerResourceAction',
  'ui.showNotification',
  'ui.openModal',
  'storage.get',
  'storage.set',
  'storage.delete',
  'storage.clear',
  'logger.info',
  'logger.warn',
  'logger.error',
  'logger.debug',
  'events.broadcast',
  'events.onBroadcast',
  'events.onClusterConnected',
  'events.onClusterDisconnected',
  'events.onResourceCreated',
  'events.onResourceUpdated',
  'events.onResourceDeleted',
]);

/** App-lifecycle subscription methods and the pluginEventBus event they map to. */
const APP_EVENT_BY_METHOD: Record<string, string> = {
  onClusterConnected: 'cluster:connected',
  onClusterDisconnected: 'cluster:disconnected',
  onResourceCreated: 'resource:created',
  onResourceUpdated: 'resource:updated',
  onResourceDeleted: 'resource:deleted',
};

function toCloneable(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

const MAX_LOGGED_OUTPUT = 2000;

function clipOutput(data: Buffer): string {
  const text = data.toString().trimEnd();
  return text.length > MAX_LOGGED_OUTPUT
    ? `${text.slice(0, MAX_LOGGED_OUTPUT)}... (${text.length} chars)`
    : text;
}

function defaultFork(
  modulePath: string,
  serviceName: string
): UtilityProcessLike {
  // Resolved lazily so unit tests (which mock 'electron') never touch it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const electron = require('electron') as typeof import('electron');
  return electron.utilityProcess.fork(modulePath, [], {
    serviceName,
    stdio: 'pipe',
    env: hostEnvironment(),
  });
}

/**
 * Handle to a plugin module running in a utility process. Mirrors the shape
 * plugin-manager needs: existence checks, invocation, and teardown.
 */
export class RemotePluginModule implements PluginModuleHandle {
  readonly isRemote = true;
  private exportNames: Set<string>;
  private host: PluginHostHandle;

  constructor(exportNames: string[], host: PluginHostHandle) {
    this.exportNames = new Set(exportNames);
    this.host = host;
  }

  has(name: string): boolean {
    return this.exportNames.has(name);
  }

  invoke(
    name: string,
    options: PluginModuleInvokeOptions = {}
  ): Promise<unknown> {
    return this.host.invoke(name, options);
  }

  dispose(): void {
    this.host.dispose();
  }
}

/** One spawned utility process plus its RPC bookkeeping. */
class PluginHostHandle {
  readonly pluginId: string;
  private child: UtilityProcessLike;
  private context: PluginContext;
  private nextInvokeId = 1;
  private pendingInvokes = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();
  /** Cleanup functions for live subscriptions, keyed by host cbId. */
  private subscriptionCleanups = new Map<number, () => void>();
  private disposed = false;
  private onGone: (pluginId: string) => void;

  constructor(
    pluginId: string,
    child: UtilityProcessLike,
    context: PluginContext,
    onGone: (pluginId: string) => void
  ) {
    this.pluginId = pluginId;
    this.child = child;
    this.context = context;
    this.onGone = onGone;

    child.on('message', (message) =>
      this.handleMessage(message as HostToMainMessage)
    );
    child.on('exit', (code) => this.handleExit(code));
    // Plugin output lands in main.log, which users attach to issues: keep
    // each chunk bounded so a chatty (or careless) plugin cannot fill it.
    child.stdout?.on('data', (data: Buffer) =>
      log.info(`[PluginHost:${pluginId}]`, clipOutput(data))
    );
    child.stderr?.on('data', (data: Buffer) =>
      log.error(`[PluginHost:${pluginId}]`, clipOutput(data))
    );
  }

  send(message: MainToHostMessage): void {
    if (!this.disposed) this.child.postMessage(message);
  }

  invoke(
    name: string,
    options: { withContext?: boolean; args?: unknown[] }
  ): Promise<unknown> {
    if (this.disposed) {
      return Promise.reject(
        new Error(`Plugin host for ${this.pluginId} is not running`)
      );
    }
    const id = this.nextInvokeId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingInvokes.delete(id);
        reject(
          new Error(
            `Plugin ${this.pluginId}: "${name}" timed out after ${INVOKE_TIMEOUT_MS}ms`
          )
        );
      }, INVOKE_TIMEOUT_MS);
      this.pendingInvokes.set(id, { resolve, reject, timer });
      this.send({
        type: 'invoke',
        id,
        name,
        withContext: options.withContext ?? false,
        args: options.args ?? [],
      });
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.send({ type: 'shutdown' });
    this.disposed = true;
    this.teardown();
    this.child.kill();
    this.onGone(this.pluginId);
  }

  private handleExit(code: number): void {
    if (!this.disposed) {
      if (code === 0) {
        log.info(`[PluginHostManager] Host for ${this.pluginId} exited`);
      } else {
        log.error(
          `[PluginHostManager] Host for ${this.pluginId} exited unexpectedly (code ${code})`
        );
      }
      this.disposed = true;
      this.teardown();
      this.onGone(this.pluginId);
    }
  }

  /** Release subscriptions and reject anything still in flight. */
  private teardown(): void {
    for (const cleanup of this.subscriptionCleanups.values()) {
      try {
        cleanup();
      } catch (error: unknown) {
        log.warn(
          `[PluginHostManager] Cleanup failed for ${this.pluginId}:`,
          getErrorMessage(error)
        );
      }
    }
    this.subscriptionCleanups.clear();
    for (const [, pending] of this.pendingInvokes) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`Plugin host for ${this.pluginId} terminated`));
    }
    this.pendingInvokes.clear();
  }

  private handleMessage(message: HostToMainMessage): void {
    switch (message.type) {
      case 'invoke-result': {
        const pending = this.pendingInvokes.get(message.id);
        if (!pending) break;
        this.pendingInvokes.delete(message.id);
        clearTimeout(pending.timer);
        if (message.ok) pending.resolve(message.result);
        else pending.reject(new Error(message.error ?? 'Unknown error'));
        break;
      }
      case 'context-call':
        void this.handleContextCall(message);
        break;
      case 'context-notify':
        try {
          this.callContextMethod(message.path, message.args, undefined);
        } catch (error: unknown) {
          log.warn(
            `[PluginHostManager] ${this.pluginId} ${message.path} failed:`,
            getErrorMessage(error)
          );
        }
        break;
      case 'unsubscribe': {
        const cleanup = this.subscriptionCleanups.get(message.cbId);
        this.subscriptionCleanups.delete(message.cbId);
        try {
          cleanup?.();
        } catch (error: unknown) {
          log.warn(
            `[PluginHostManager] Unsubscribe failed for ${this.pluginId}:`,
            getErrorMessage(error)
          );
        }
        break;
      }
      // 'loaded' and 'load-error' are consumed by the spawn handshake.
      default:
        break;
    }
  }

  private async handleContextCall(
    message: Extract<HostToMainMessage, { type: 'context-call' }>
  ): Promise<void> {
    const reply = (ok: boolean, result?: unknown, error?: string): void => {
      this.send({ type: 'context-result', id: message.id, ok, result, error });
    };
    try {
      const result = this.callContextMethod(
        message.path,
        message.args,
        message.callbacks
      );
      reply(true, toCloneable(await Promise.resolve(result)));
    } catch (error: unknown) {
      reply(false, undefined, getErrorMessage(error));
    }
  }

  /**
   * Execute a context method by dot-path, materialising callback descriptors
   * into forwarder functions and recording subscription cleanups.
   */
  private callContextMethod(
    contextPath: string,
    args: unknown[],
    callbacks: CallbackRef[] | undefined
  ): unknown {
    if (!ALLOWED_CONTEXT_PATHS.has(contextPath)) {
      throw new Error(`Context method not allowed: ${contextPath}`);
    }
    const [apiName, methodName] = contextPath.split('.') as [
      keyof PluginContext,
      string,
    ];
    const api = this.context[apiName] as unknown as Record<string, unknown>;
    const method = api[methodName];
    if (typeof method !== 'function') {
      throw new Error(`Context method not found: ${contextPath}`);
    }

    const finalArgs = [...args];
    const wrappedByCbId = new Map<number, (...a: unknown[]) => void>();
    for (const ref of callbacks ?? []) {
      const wrapped = (...cbArgs: unknown[]): void => {
        this.send({
          type: 'callback',
          cbId: ref.cbId,
          args: cbArgs.map(toCloneable),
        });
      };
      wrappedByCbId.set(ref.cbId, wrapped);
      finalArgs[ref.index] = wrapped;
    }

    const result = (method as (...a: unknown[]) => unknown).apply(
      api,
      finalArgs
    );

    this.recordSubscriptionCleanup(
      contextPath,
      methodName,
      args,
      wrappedByCbId,
      result
    );
    // A function result (watch cleanup) cannot cross the process boundary.
    return typeof result === 'function' ? null : result;
  }

  private recordSubscriptionCleanup(
    contextPath: string,
    methodName: string,
    args: unknown[],
    wrappedByCbId: Map<number, (...a: unknown[]) => void>,
    result: unknown
  ): void {
    if (wrappedByCbId.size === 0) return;
    const [cbId, wrapped] = [...wrappedByCbId.entries()][0];

    if (contextPath === 'kubernetes.watchResources') {
      if (typeof result === 'function') {
        this.subscriptionCleanups.set(cbId, result as () => void);
      }
      return;
    }
    if (contextPath === 'events.onBroadcast') {
      const event = args[0] as string;
      this.subscriptionCleanups.set(cbId, () =>
        this.context.events.offBroadcast(event, wrapped)
      );
      return;
    }
    const busEvent = APP_EVENT_BY_METHOD[methodName];
    if (busEvent) {
      this.subscriptionCleanups.set(cbId, () =>
        pluginEventBus.off(busEvent, wrapped)
      );
    }
  }
}

export class PluginHostManager {
  private fork: ForkFn;
  private hosts = new Map<string, PluginHostHandle>();

  constructor(fork: ForkFn = defaultFork) {
    this.fork = fork;
  }

  /** Whether utility-process isolation can be used in this runtime. */
  isSupported(): boolean {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const electron = require('electron') as typeof import('electron');
      return typeof electron.utilityProcess?.fork === 'function';
    } catch {
      return false;
    }
  }

  isRunning(pluginId: string): boolean {
    return this.hosts.has(pluginId);
  }

  /**
   * Spawn (or return the already-running) host process for a plugin and load
   * its entry file inside it.
   */
  async spawn(options: {
    pluginId: string;
    pluginPath: string;
    mainFile: string;
    permissions: string[];
    context: PluginContext;
    hostModulePath?: string;
  }): Promise<RemotePluginModule> {
    const existing = this.hosts.get(options.pluginId);
    if (existing) existing.dispose();

    const modulePath =
      options.hostModulePath ?? path.join(__dirname, 'plugin-host.js');
    const child = this.fork(modulePath, `plugin-${options.pluginId}`);
    const handle = new PluginHostHandle(
      options.pluginId,
      child,
      options.context,
      (pluginId) => this.hosts.delete(pluginId)
    );
    this.hosts.set(options.pluginId, handle);

    const loaded = new Promise<string[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `Plugin ${options.pluginId} did not load within ${LOAD_TIMEOUT_MS}ms`
          )
        );
      }, LOAD_TIMEOUT_MS);
      child.on('message', (raw) => {
        const message = raw as HostToMainMessage;
        if (message.type === 'loaded') {
          clearTimeout(timer);
          resolve(message.exports);
        } else if (message.type === 'load-error') {
          clearTimeout(timer);
          reject(new Error(message.error));
        }
      });
      child.on('exit', (code) => {
        clearTimeout(timer);
        reject(
          new Error(
            `Plugin host for ${options.pluginId} exited before loading (code ${code})`
          )
        );
      });
    });

    handle.send({
      type: 'init',
      pluginId: options.pluginId,
      pluginPath: options.pluginPath,
      mainFile: options.mainFile,
      permissions: options.permissions,
    });

    try {
      const exportNames = await loaded;
      log.info(
        `[PluginHostManager] Plugin ${options.pluginId} loaded in utility process`
      );
      return new RemotePluginModule(exportNames, handle);
    } catch (error: unknown) {
      handle.dispose();
      throw error;
    }
  }

  /** Tear down the host process for a plugin, if one is running. */
  disposePlugin(pluginId: string): void {
    this.hosts.get(pluginId)?.dispose();
  }

  /** Tear down every running host (app shutdown). */
  disposeAll(): void {
    for (const handle of [...this.hosts.values()]) handle.dispose();
  }
}

export const pluginHostManager = new PluginHostManager();
