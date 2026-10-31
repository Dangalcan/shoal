/**
 * Plugin permissions
 *
 * The one list every gate checks against: the manifest validator, the
 * main-process PluginContext, the plugin host process and the renderer
 * sandbox bridge (`METHOD_TABLE`). Pure module, no Node or DOM imports, so
 * both processes import it (like plugin-file-url.ts).
 *
 * - `kubernetes`: read the cluster. List and get resources, describe, YAML,
 *   logs, metrics, watches and resource events. Secrets arrive without their
 *   data unless `secrets` is declared too.
 * - `kubernetes:write`: change the cluster. Create, update and delete
 *   resources, save and apply manifests, run commands in pods.
 * - `helm`: every Helm call (install, upgrade, rollback, uninstall, repo add
 *   and list).
 * - `secrets`: the payload of Secrets (`data`, `stringData` and the
 *   last-applied annotation) in what `kubernetes` returns. Needs `kubernetes`.
 * - `ui`: sidebar items, pages, modals, notifications, external links.
 * - `storage`: the plugin's own persisted key-value storage.
 */

export const PLUGIN_PERMISSIONS = [
  'kubernetes',
  'kubernetes:write',
  'helm',
  'secrets',
  'ui',
  'storage',
] as const;

/** A permission a plugin can declare in its manifest. */
export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[number];

export function isPluginPermission(value: unknown): value is PluginPermission {
  return (PLUGIN_PERMISSIONS as readonly unknown[]).includes(value);
}

/** The error every gate throws when a permission is missing. */
export function permissionDeniedMessage(
  what: string,
  permission: PluginPermission
): string {
  return `Permission denied: "${what}" requires the "${permission}" permission`;
}
