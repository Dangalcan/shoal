/**
 * Recognises the message the main process produces for a tool that is not
 * installed (`describeExecError` in electron/utils/safe-exec.ts), so pages
 * that already show a "kubectl is missing" notice can skip the toast.
 */
export function isToolMissingMessage(
  message: string | null | undefined
): boolean {
  return (
    typeof message === 'string' &&
    / is not installed or not on the PATH$/.test(message.trim())
  );
}
