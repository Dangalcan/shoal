import { toast } from 'sonner';

/**
 * Centralized error handler for the application.
 * Logs the error and displays a user-friendly toast notification.
 */
export const handleError = (error: unknown, title?: string, options?: any) => {
  console.error(`[Error] ${title || 'Error'}:`, error);

  let message = 'An unexpected error occurred. Please try again.';

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object') {
    if ('message' in error) {
      message = String((error as { message: unknown }).message);
    } else if ('error' in error) {
      message = String((error as { error: unknown }).error);
    }
  }

  // If title is provided and not generic, use it as title and message as description.
  // Otherwise, use message as title for better compatibility with existing tests.
  const finalTitle = title && title !== 'An error occurred' ? title : message;
  const finalDescription =
    title && title !== 'An error occurred' ? message : undefined;

  toast.error(finalTitle, {
    description: finalDescription,
    duration: 5000,
    ...options,
  });
};

/**
 * Specific handler for IPC/Bridge errors.
 */
export const handleIpcError = (error: unknown, action: string) => {
  handleError(error, `Failed to ${action}`);
};
