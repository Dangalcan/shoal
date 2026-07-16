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
  const routes: Record<string, (args: unknown[]) => Promise<unknown>> = {
    'kubernetes.getResources': (a) => electron.getResources(a[0] as never),
    'kubernetes.getPods': (a) => electron.getPods(a[0] as string),
    'kubernetes.getNamespaces': (a) => electron.getNamespaces(a[0] as string),
    'kubernetes.getLogs': (a) => electron.getLogs(a[0] as never),
    'kubernetes.describeResource': (a) =>
      electron.describeResource(a[0] as never),
    'kubernetes.getResourceYaml': (a) =>
      electron.getResourceYaml(a[0] as never),
    'kubernetes.deleteResource': (a) => electron.deleteResource(a[0] as never),
    'kubernetes.getCurrentContext': () => electron.getCurrentContext(),
    'kubernetes.getClusters': () => electron.getClusters(),
    'manifests.apply': (a) => electron.applyManifest(a[0] as number),
    'manifests.save': (a) => electron.saveManifest(a[0] as never),
    'helm.install': (a) => electron.helmInstall(a[0] as never),
    'helm.upgrade': (a) => electron.helmUpgrade(a[0] as never),
    'helm.rollback': (a) => electron.helmRollback(a[0] as never),
    'helm.uninstall': (a) => electron.helmUninstall(a[0] as never),
    'helm.repoAdd': (a) => electron.helmRepoAdd(a[0] as never),
    'helm.repoList': () => electron.helmRepoList(),
    'settings.get': (a) => electron.getPluginSettings(a[0] as string),
    'settings.set': (a) =>
      electron.setPluginSettings(
        a[0] as string,
        a[1] as Record<string, unknown>
      ),
    'ui.openExternal': (a) => electron.openExternal(a[0] as string),
  };

  return async (method: string, args: unknown[]): Promise<unknown> => {
    const route = Object.prototype.hasOwnProperty.call(routes, method)
      ? routes[method]
      : undefined;
    if (!route) {
      throw new Error(`Unrouted plugin method: "${method}"`);
    }
    return unwrap(await route(args));
  };
}
