import { toast } from 'sonner';

/**
 * Centralized error handler for the application.
 * Logs the error and displays a user-friendly toast notification.
 */
export const handleError = (error: unknown, title = 'An error occurred') => {
  console.error(`[Error] ${title}:`, error);

  let message = 'An unexpected error occurred. Please try again.';

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String((error as { message: unknown }).message);
  }

  toast.error(title, {
    description: message,
    duration: 5000,
  });
};

/**
 * Specific handler for IPC/Bridge errors.
 */
export const handleIpcError = (error: unknown, action: string) => {
  handleError(error, `Failed to ${action}`);
};
