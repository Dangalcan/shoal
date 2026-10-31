/**
 * Permission gate for the Node-side plugin API, shared by the in-process
 * PluginContext (the enforcing side) and the plugin host process (which
 * mirrors it so a plugin gets a local error without a round trip).
 */

import type { KubernetesAPI } from '../../types/plugin-types';
import {
  permissionDeniedMessage,
  type PluginPermission,
} from '../../shared/plugin-permissions';

/** The permission each `context.kubernetes` method needs. */
export const KUBERNETES_METHOD_PERMISSION: Record<
  keyof KubernetesAPI,
  PluginPermission
> = {
  getResources: 'kubernetes',
  getPodMetrics: 'kubernetes',
  watchResources: 'kubernetes',
  createResource: 'kubernetes:write',
  updateResource: 'kubernetes:write',
  deleteResource: 'kubernetes:write',
  executeCommand: 'kubernetes:write',
};

/** Throws the standard permission error unless `permission` was declared. */
export function assertPluginPermission(
  permissions: readonly string[],
  permission: PluginPermission,
  what: string
): void {
  if (!permissions.includes(permission)) {
    throw new Error(permissionDeniedMessage(what, permission));
  }
}
