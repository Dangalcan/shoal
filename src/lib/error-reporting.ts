/**
 * Renderer error reporting.
 *
 * Errors are written to the main log file (ipc `log-renderer-error`); nothing
 * is sent anywhere. "Report a problem" opens a prefilled GitHub issue that the
 * user reviews and submits themselves.
 */

import { electronService } from '../services/electronService';
import type { AppInfo } from '../types.d';

export const ISSUES_URL = 'https://github.com/Dangalcan/shoal/issues/new';

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: `${error.name}: ${error.message}`, stack: error.stack };
  }
  return { message: String(error) };
}

/** Writes an error to the main log. Never throws. */
export function reportRendererError(
  error: unknown,
  source: string,
  extraStack?: string
): void {
  const { message, stack } = describe(error);
  const fullStack = [stack, extraStack].filter(Boolean).join('\n');
  electronService
    .logRendererError({ source, message, stack: fullStack || undefined })
    .catch(() => {
      // The log is best effort; never let reporting raise a second error.
    });
}

let installed = false;

/** Logs uncaught errors and unhandled promise rejections. Idempotent. */
export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('error', (event) => {
    reportRendererError(event.error ?? event.message, 'window-error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportRendererError(event.reason, 'unhandledrejection');
  });
}

/**
 * GitHub "new issue" URL that opens the bug report form with the environment
 * fields filled in (the query parameters are the form's field ids, see
 * .github/ISSUE_TEMPLATE/bug_report.yml). The log itself is never attached
 * automatically: the user decides what to share.
 */
export function buildIssueUrl(
  info: AppInfo | null,
  errorText?: string
): string {
  const params = new URLSearchParams({ template: 'bug_report.yml' });
  params.set('version', info?.version ?? 'unknown');
  params.set('os', info ? `${info.platform} ${info.arch}` : 'unknown');
  params.set('electron', info?.electron ?? 'unknown');
  if (info?.logsPath) {
    params.set(
      'logs',
      `Logs folder: ${info.logsPath} (attach main.log only if you are comfortable sharing it)`
    );
  }
  if (errorText) {
    params.set('what', ['```', errorText.slice(0, 1500), '```'].join('\n'));
  }
  return `${ISSUES_URL}?${params.toString()}`;
}
