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
 * GitHub "new issue" URL with version, OS and where to find the log. The log
 * itself is never attached automatically: the user decides what to share.
 */
export function buildIssueUrl(
  info: AppInfo | null,
  errorText?: string
): string {
  const lines = [
    '**What happened?**',
    '',
    '',
    '**Steps to reproduce**',
    '',
    '',
    '---',
    `- Shoal: ${info?.version ?? 'unknown'}`,
    `- OS: ${info ? `${info.platform} ${info.arch}` : 'unknown'}`,
    `- Electron: ${info?.electron ?? 'unknown'}`,
  ];
  if (info?.logsPath) {
    lines.push(
      `- Logs: \`${info.logsPath}\` (attach main.log if you are comfortable sharing it)`
    );
  }
  if (errorText) {
    lines.push('', '```', errorText.slice(0, 1500), '```');
  }
  const params = new URLSearchParams({ body: lines.join('\n') });
  return `${ISSUES_URL}?${params.toString()}`;
}
