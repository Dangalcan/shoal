/** Returns the message string from an unknown error value. */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
