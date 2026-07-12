/**
 * Helpers for turning a Plugin into the props a PluginFrame needs, shared by
 * the plugin page host and the dashboard widget host so both build the sandbox
 * URLs and permission set the same way.
 */

import type { Plugin } from '../../../../electron/types/plugin-types';
import type { PluginPermission } from './protocol';

const SANDBOX_PERMISSIONS: PluginPermission[] = ['kubernetes', 'ui', 'storage'];

/** Keep only the manifest permissions the sandbox bridge understands. */
export function toSandboxPermissions(
  list: string[] | undefined
): PluginPermission[] {
  return (list ?? []).filter((p): p is PluginPermission =>
    (SANDBOX_PERMISSIONS as string[]).includes(p)
  );
}

export interface PluginFrameUrls {
  hostDocumentUrl: string;
  entryUrl: string;
  styleUrls: string[];
  permissions: PluginPermission[];
}

/** Build the sandbox host-document URL shared by all plugin frames. */
export function pluginHostDocumentUrl(): string {
  return new URL('plugin-host/index.html', document.baseURI).href;
}

/**
 * Resolve the sandbox URLs + permissions for a plugin. Returns null when the
 * plugin ships no renderer entry (nothing to mount).
 */
export function buildPluginFrameUrls(plugin: Plugin): PluginFrameUrls | null {
  if (!plugin.rendererEntry) return null;
  return {
    hostDocumentUrl: pluginHostDocumentUrl(),
    entryUrl: `plugin-file:///${plugin.rendererEntry}`,
    styleUrls: (plugin.rendererStyles ?? []).map((s) => `plugin-file:///${s}`),
    permissions: toSandboxPermissions(plugin.manifest.permissions),
  };
}
