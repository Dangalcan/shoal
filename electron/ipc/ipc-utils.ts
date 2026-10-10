/**
 * IPC Utilities
 *
 * Shared wrapper used by all IPC handler modules. Input validation lives in
 * utils/k8s-validate.ts (re-exported here) so the service layer enforces the
 * same rules; execution goes through utils/safe-exec.ts (execFile, no shell).
 */

import type { IpcMainInvokeEvent } from 'electron';
import { getErrorMessage } from '../utils/error-utils';
import log from '../logger';

export const DEFAULT_LOG_TAIL_LINES = 200;

export { ALLOWED_TOOLS } from '../utils/safe-exec';
export {
  assertContext,
  assertResourceType,
  assertNamespace,
  assertResourceName,
} from '../utils/k8s-validate';

/** Object keys whose values never reach the logs (licenses, tokens, helm values...). */
const SENSITIVE_KEY = /key|token|secret|password|credential|license|values/i;
const MAX_LOGGED_STRING = 200;
const MAX_LOGGED_DEPTH = 4;

/**
 * Copy of IPC arguments that is safe to log: values under sensitive keys are
 * replaced, long strings truncated and deep structures cut off.
 */
export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > MAX_LOGGED_DEPTH) return '[...]';
  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[redacted]' : redactForLog(item, depth + 1),
      ])
    );
  }
  if (typeof value === 'string' && value.length > MAX_LOGGED_STRING) {
    return `${value.slice(0, MAX_LOGGED_STRING)}... (${value.length} chars)`;
  }
  return value;
}

export const wrapIpcHandler = <T>(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T>
) => {
  return async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    const timestamp = new Date().toISOString();
    log.debug(
      `[${timestamp}] [IPC] [${name}] REQUEST:`,
      JSON.stringify(redactForLog(args))
    );

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
