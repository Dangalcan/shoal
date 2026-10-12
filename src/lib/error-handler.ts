import { toast } from 'sonner';

/**
 * Options for error toast notifications.
 */
export interface ErrorOptions {
  /** Toast ID for updating an existing toast */
  id?: string | number;
  /** Duration in milliseconds (default: 5000) */
  duration?: number;
  /** Optional description to show below the title */
  description?: string;
}

/**
 * Centralized error handler for the application.
 * Logs the error and displays a user-friendly toast notification.
 *
 * @param error - The error to handle (Error, string, or object with message/error property)
 * @param title - The title for the error toast
 * @param options - Optional configuration for the toast
 *
 * @example
 * ```typescript
 * // Simple error
 * handleError(new Error('Something went wrong'), 'Operation Failed');
 *
 * // With description
 * handleError(err, 'Failed to delete cluster', {
 *   description: 'The cluster may still be running'
 * });
 *
 * // Update existing toast
 * const toastId = toast.loading('Deleting...');
 * handleError(err, 'Failed to delete', { id: toastId });
 * ```
 */
export const handleError = (
  error: unknown,
  title: string,
  options?: ErrorOptions
) => {
  console.error(`[Error] ${title}:`, error);

  let description = options?.description;

  // If no explicit description provided, extract from error
  if (!description) {
    if (error instanceof Error) {
      description = error.message;
    } else if (typeof error === 'string') {
      description = error;
    } else if (error && typeof error === 'object') {
      if ('message' in error) {
        description = String((error as { message: unknown }).message);
      } else if ('error' in error) {
        description = String((error as { error: unknown }).error);
      }
    }
  }

  toast.error(title, {
    description,
    duration: options?.duration ?? 5000,
    id: options?.id,
  });
};
