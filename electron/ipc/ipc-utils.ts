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
