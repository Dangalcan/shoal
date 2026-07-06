/**
 * Electron Invoker
 *
 * Maps the sandbox's allowlisted method names onto real `window.electron`
 * IPC calls, unwrapping the `{ success, data }` Result envelope into a plain
 * resolved value (or a thrown error). Used by the host bridge's `invoke`.
 *
 * The permission gate has already run in PluginHostBridge before this is
 * called; this module only performs routing. `settings.*` receive the
 * plugin's own id as the first argument (injected by the bridge).
 */

import type { ElectronAPI } from '../../../types.d';

interface ResultLike {
  success: boolean;
  data?: unknown;
  error?: string;
}

function unwrap(res: unknown): unknown {
  if (res && typeof res === 'object' && 'success' in res) {
    const r = res as ResultLike;
    if (!r.success) throw new Error(r.error || 'Plugin API call failed');
    return r.data;
  }
  return res;
}

/**
 * Build the `invoke(method, args)` function the host bridge calls for a plugin.
 * Only allowlisted methods reach here; anything unrouted throws.
 */
export function createElectronInvoker(
  electron: ElectronAPI
): (method: string, args: unknown[]) => Promise<unknown> {
  return async (method: string, args: unknown[]): Promise<unknown> => {
    switch (method) {
      case 'kubernetes.getResources':
        return unwrap(await electron.getResources(args[0] as never));
      case 'kubernetes.getPods':
        return unwrap(await electron.getPods(args[0] as string));
      case 'kubernetes.getNamespaces':
        return unwrap(await electron.getNamespaces(args[0] as string));
      case 'kubernetes.getLogs':
        return unwrap(await electron.getLogs(args[0] as never));
      case 'kubernetes.describeResource':
        return unwrap(await electron.describeResource(args[0] as never));
      case 'kubernetes.getResourceYaml':
        return unwrap(await electron.getResourceYaml(args[0] as never));
      case 'kubernetes.deleteResource':
        return unwrap(await electron.deleteResource(args[0] as never));
      case 'kubernetes.getCurrentContext':
        return unwrap(await electron.getCurrentContext());
      case 'kubernetes.getClusters':
        return unwrap(await electron.getClusters());
      case 'manifests.apply':
        return unwrap(await electron.applyManifest(args[0] as number));
      case 'manifests.save':
        return unwrap(await electron.saveManifest(args[0] as never));
      case 'settings.get':
        return unwrap(await electron.getPluginSettings(args[0] as string));
      case 'settings.set':
        return unwrap(
          await electron.setPluginSettings(
            args[0] as string,
            args[1] as Record<string, unknown>
          )
        );
      case 'ui.openExternal':
        return unwrap(await electron.openExternal(args[0] as string));
      default:
        throw new Error(`Unrouted plugin method: "${method}"`);
    }
  };
}
