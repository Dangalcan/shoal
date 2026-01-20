import { toast } from 'sonner';
import { handleError } from './error-handler';

/**
 * Options for handling async operations.
 */
export interface AsyncOperationOptions {
  /** Message to show in loading toast */
  loadingMessage: string;
  /** Message to show in success toast */
  successMessage: string;
  /** Title for error toast */
  errorTitle: string;
  /** Optional callback to run on success */
  onSuccess?: () => void | Promise<void>;
}

import { Result } from '../types/result';

/**
 * Generic handler for async operations with loading states and error handling.
 *
 * This utility provides consistent UX for async operations by:
 * - Showing a loading toast
 * - Handling success/error states
 * - Updating the toast accordingly
 * - Running optional success callbacks
 *
 * @param operation - The async operation to execute (should return Result)
 * @param options - Configuration for toast messages and callbacks
 * @returns Result object
 *
 * @example
 * ```typescript
 * const deleteCluster = async (name: string) => {
 *   return handleAsyncOperation(
 *     () => electronService.deleteCluster(name),
 *     {
 *       loadingMessage: `Deleting cluster "${name}"...`,
 *       successMessage: `Cluster "${name}" deleted.`,
 *       errorTitle: 'Failed to delete cluster',
 *       onSuccess: () => fetchClusters(),
 *     }
 *   );
 * };
 * ```
 */
export async function handleAsyncOperation<T = void>(
  operation: () => Promise<Result<T>>,
  options: AsyncOperationOptions
): Promise<Result<T>> {
  const toastId = toast.loading(options.loadingMessage);

  try {
    const result = await operation();

    if (result.success) {
      toast.success(options.successMessage, { id: toastId });

      // Run success callback if provided
      if (options.onSuccess) {
        await options.onSuccess();
      }

      return result;
    } else {
      const errorMsg = result.error || `${options.errorTitle} failed`;
      handleError(errorMsg, options.errorTitle, { id: toastId });
      return { success: false, error: errorMsg };
    }
  } catch (err) {
    handleError(err, options.errorTitle, { id: toastId });
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'An unexpected error occurred.',
    };
  }
}
