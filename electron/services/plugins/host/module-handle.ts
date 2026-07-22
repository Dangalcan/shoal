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
    return typeof this.moduleExports[name] === 'function';
  }

  async invoke(
    name: string,
    options: PluginModuleInvokeOptions = {},
    context?: PluginContext
  ): Promise<unknown> {
    const target = this.moduleExports[name];
    if (typeof target !== 'function') {
      throw new Error(`Export "${name}" is not a function`);
    }
    const args = options.withContext ? [context] : (options.args ?? []);
    return await (target as (...a: unknown[]) => unknown)(...args);
  }

  dispose(): void {
    // Nothing to release: the module cache is owned by the loader.
  }
}
