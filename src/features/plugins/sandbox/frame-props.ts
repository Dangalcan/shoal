/**
 * Helpers for turning a Plugin into the props a PluginFrame needs, shared by
 * the plugin page host and the dashboard widget host so both build the sandbox
 * URLs and permission set the same way.
 */

import type { Plugin } from '../../../../electron/types/plugin-types';
import type { PluginPermission } from './protocol';
import { isPluginPermission } from '../../../../electron/shared/plugin-permissions';
import {
  toFrameSafeUrl,
  toPluginFileUrl,
} from '../../../../electron/shared/plugin-file-url';

/**
 * Keep only the permissions the sandbox bridge knows. A manifest written for
 * another version of Shoal may name others; they grant nothing here.
 */
export function toSandboxPermissions(
  list: string[] | undefined
): PluginPermission[] {
  return (list ?? []).filter(isPluginPermission);
}

export interface PluginFrameUrls {
  hostDocumentUrl: string;
  entryUrl: string;
  styleUrls: string[];
  permissions: PluginPermission[];
}

/**
 * Build the sandbox host-document URL shared by all plugin frames. Packaged
 * builds load the app from file:, which an opaque-origin frame may not use,
 * so the host document is served through plugin-file: there.
 */
export function pluginHostDocumentUrl(): string {
  return toFrameSafeUrl(
    new URL('plugin-host/index.html', document.baseURI).href
  );
}

/**
 * Resolve the sandbox URLs + permissions for a plugin. Returns null when the
 * plugin ships no renderer entry (nothing to mount).
 */
export function buildPluginFrameUrls(plugin: Plugin): PluginFrameUrls | null {
  if (!plugin.rendererEntry) return null;
  return {
    hostDocumentUrl: pluginHostDocumentUrl(),
    entryUrl: toPluginFileUrl(plugin.rendererEntry),
    styleUrls: (plugin.rendererStyles ?? []).map(toPluginFileUrl),
    permissions: toSandboxPermissions(plugin.manifest.permissions),
  };
}
