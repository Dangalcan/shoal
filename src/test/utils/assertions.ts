import { expect } from 'vitest';
import { toast } from 'sonner';

/**
 * Asserts that an error toast was shown with the given message.
 *
 * @param message - Expected message (can be partial match)
 *
 * @example
 * ```typescript
 * await deleteCluster('test');
 * expectToastError('Failed to delete');
 * ```
 */
export function expectToastError(message: string) {
  expect(toast.error).toHaveBeenCalledWith(
    expect.stringContaining(message),
    expect.anything()
  );
}

/**
 * Asserts that a success toast was shown with the given message.
 *
 * @param message - Expected message (can be partial match)
 *
 * @example
 * ```typescript
 * await deleteCluster('test');
 * expectToastSuccess('deleted');
 * ```
 */
export function expectToastSuccess(message: string) {
  expect(toast.success).toHaveBeenCalledWith(
    expect.stringContaining(message),
    expect.anything()
  );
}

/**
 * Asserts that a loading toast was shown with the given message.
 *
 * @param message - Expected message (can be partial match)
 *
 * @example
 * ```typescript
 * deleteCluster('test'); // Don't await
 * expectToastLoading('Deleting');
 * ```
 */
export function expectToastLoading(message: string) {
  expect(toast.loading).toHaveBeenCalledWith(expect.stringContaining(message));
}

/**
 * Asserts that an Electron IPC method was called with specific arguments.
 *
 * @param method - The method name on window.electron
 * @param args - Expected arguments (can use expect matchers)
 *
 * @example
 * ```typescript
 * await deleteCluster('test-cluster');
 * expectElectronCall('deleteCluster', 'test-cluster');
 * ```
 */
export function expectElectronCall(method: string, ...args: any[]) {
  const electronMethod = (window.electron as any)[method];
  expect(electronMethod).toHaveBeenCalledWith(...args);
}
