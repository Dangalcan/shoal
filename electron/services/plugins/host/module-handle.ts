/**
 * Plugin Module Handle
 *
 * Uniform interface over a loaded plugin module, whether it runs in-process
 * (trusted/bundled plugins, vm sandbox in main) or in an isolated Electron
 * utility process (untrusted/user-installed plugins).
 */

import type { PluginContext } from '../../../types/plugin-types';

export interface PluginModuleInvokeOptions {
  /** Pass the plugin's context as the sole argument (lifecycle hooks). */
  withContext?: boolean;
  /** Positional arguments when withContext is false (actions). */
  args?: unknown[];
  /**
   * Upper bound for the call, in milliseconds. In-process code cannot be
   * interrupted, so the call keeps running in the background and the caller
   * gets a rejection instead of waiting forever. Isolated modules apply the
   * host's own timeouts and ignore this.
   */
  timeoutMs?: number;
}

/**
 * Rejects when `promise` has not settled within `ms`. The promise itself
 * keeps running; its later outcome is dropped.
 */
export function withinTimeout<T>(
  promise: Promise<T>,
  ms: number,
  what: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${what} timed out after ${ms} ms`)),
      ms
    );
  });
  return Promise.race([promise, expiry]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export interface PluginModuleHandle {
  readonly isRemote: boolean;
  /** True when the named export exists and is callable. */
  has(name: string): boolean;
  /**
   * Call an exported function. `context` is used by the in-process
   * implementation; the remote host substitutes its own proxied context.
   */
  invoke(
    name: string,
    options?: PluginModuleInvokeOptions,
    context?: PluginContext
  ): Promise<unknown>;
  dispose(): void;
}

/** In-process module handle wrapping the vm-sandbox exports object. */
export class LocalPluginModule implements PluginModuleHandle {
  readonly isRemote = false;
  private moduleExports: Record<string, unknown>;

  constructor(moduleExports: Record<string, unknown>) {
    this.moduleExports = moduleExports;
  }

  has(name: string): boolean {
    return this.ownFunction(name) !== undefined;
  }

  /** A function the module itself exports; nothing from the prototype chain. */
  private ownFunction(name: string): unknown {
    if (!Object.prototype.hasOwnProperty.call(this.moduleExports, name)) {
      return undefined;
    }
    const target = this.moduleExports[name];
    return typeof target === 'function' ? target : undefined;
  }

  async invoke(
    name: string,
    options: PluginModuleInvokeOptions = {},
    context?: PluginContext
  ): Promise<unknown> {
    const target = this.ownFunction(name);
    if (typeof target !== 'function') {
      throw new Error(`Export "${name}" is not a function`);
    }
    const args = options.withContext ? [context] : (options.args ?? []);
    const fn = target as (...a: unknown[]) => unknown;
    // The async wrapper turns a synchronous throw into a rejection too.
    const call = (async () => fn(...args))();
    if (options.timeoutMs === undefined) return await call;
    return await withinTimeout(call, options.timeoutMs, `${name}()`);
  }

  dispose(): void {
    // Nothing to release: the module cache is owned by the loader.
  }
}
