/**
 * IPC Utilities
 *
 * Shared wrapper and input-validation helpers used by all IPC handler modules.
 * All kubectl arguments MUST pass validation before use in shell commands to
 * prevent command injection from a compromised renderer.
 */

import type { IpcMainInvokeEvent } from 'electron';
import { getErrorMessage } from '../utils/error-utils';
import log from '../logger';

export const DEFAULT_LOG_TAIL_LINES = 200;

export const ALLOWED_TOOLS = new Set([
  'kubectl',
  'helm',
  'kind',
  'minikube',
  'k3d',
  'k9s',
  'kubectx',
  'kubens',
  'docker',
  'podman',
]);

/** Kubernetes context names: alphanumeric + .-_@/: */
const CONTEXT_NAME_RE = /^[a-zA-Z0-9._\-@/:]+$/;
/** Kubernetes resource types: alphanumeric + ./ */
const RESOURCE_TYPE_RE = /^[a-zA-Z0-9./]+$/;
/** Kubernetes namespaces: RFC 1123 DNS label, or the literal "all" */
const NAMESPACE_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$|^all$/;
/** Kubernetes resource/pod names: alphanumeric + .-_ */
const RESOURCE_NAME_RE = /^[a-zA-Z0-9._\-]+$/;

export function assertContext(v: string): void {
  if (!v || !CONTEXT_NAME_RE.test(v))
    throw new Error(`Invalid context name: "${v}"`);
}
export function assertResourceType(v: string): void {
  if (!v || !RESOURCE_TYPE_RE.test(v))
    throw new Error(`Invalid resource type: "${v}"`);
}
export function assertNamespace(v: string): void {
  if (!v || !NAMESPACE_RE.test(v)) throw new Error(`Invalid namespace: "${v}"`);
}
export function assertResourceName(v: string): void {
  if (!v || !RESOURCE_NAME_RE.test(v))
    throw new Error(`Invalid resource name: "${v}"`);
}

export const wrapIpcHandler = <T>(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T>
) => {
  return async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    const timestamp = new Date().toISOString();
    log.debug(`[${timestamp}] [IPC] [${name}] REQUEST:`, JSON.stringify(args));

    try {
      const result = await handler(event, ...args);
      const formattedResult =
        result && typeof result === 'object' && 'success' in result
          ? result
          : { success: true, data: result };

      log.debug(`[${timestamp}] [IPC] [${name}] SUCCESS`);
      return formattedResult;
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      log.error(`[${timestamp}] [IPC] [${name}] ERROR:`, msg);
      return { success: false, error: msg };
    }
  };
};
