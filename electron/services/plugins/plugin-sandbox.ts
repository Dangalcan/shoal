/**
 * Plugin Sandbox
 *
 * Executes plugin CommonJS code inside an isolated V8 context via Node's `vm`
 * module. Plugins receive no access to Node.js I/O APIs; only a safe built-in
 * allowlist and relative imports within the plugin directory are permitted.
 */

import vm from 'vm';
import path from 'path';
import { readFileSync } from 'fs';

/** Node.js built-ins that are safe to expose to plugin code. */
export const ALLOWED_BUILTINS = new Set([
  'path',
  'util',
  'os',
  'url',
  'events',
  'stream',
  'crypto',
]);

/**
 * Execute plugin source code in a sandboxed VM context.
 *
 * @param code        - CommonJS source code string
 * @param filename    - Absolute path (used for stack traces and relative require resolution)
 * @param pluginDir   - Plugin root directory (require cannot escape above this)
 * @param moduleCache - Shared per-session cache (handles circular requires)
 */
export function executeInSandbox(
  code: string,
  filename: string,
  pluginDir: string,
  moduleCache: Map<string, unknown>
): unknown {
  const moduleObj = { exports: {} as Record<string, unknown> };

  const sandboxedRequire = (specifier: string): unknown => {
    if (ALLOWED_BUILTINS.has(specifier)) {
      return require(specifier);
    }

    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      const resolved = path.resolve(path.dirname(filename), specifier);

      if (!resolved.startsWith(path.resolve(pluginDir))) {
        throw new Error(
          `[PluginSandbox] Path traversal blocked: "${specifier}"`
        );
      }

      const candidates = [
        resolved,
        `${resolved}.js`,
        path.join(resolved, 'index.js'),
      ];

      for (const candidate of candidates) {
        if (moduleCache.has(candidate)) {
          return moduleCache.get(candidate);
        }
        try {
          const childCode = readFileSync(candidate, 'utf8');
          moduleCache.set(candidate, {}); // reserve slot before recursing
          const childExports = executeInSandbox(
            childCode,
            candidate,
            pluginDir,
            moduleCache
          );
          moduleCache.set(candidate, childExports);
          return childExports;
        } catch {
          continue;
        }
      }

      throw new Error(`[PluginSandbox] Cannot find module: "${specifier}"`);
    }

    throw new Error(
      `[PluginSandbox] Module "${specifier}" is not allowed. ` +
        `Plugins may only import relative files or: ${[...ALLOWED_BUILTINS].join(', ')}`
    );
  };

  const context = vm.createContext({
    module: moduleObj,
    exports: moduleObj.exports,
    require: sandboxedRequire,
    __dirname: path.dirname(filename),
    __filename: filename,
    console,
    Buffer,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    setImmediate,
    clearImmediate,
    queueMicrotask,
    process: {
      platform: process.platform,
      version: process.version,
      versions: process.versions,
      env: {},
    },
  });

  const script = new vm.Script(code, { filename });
  script.runInContext(context, { timeout: 10_000 });

  return moduleObj.exports;
}
