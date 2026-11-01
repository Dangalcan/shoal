import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildIssueUrl,
  reportRendererError,
  installGlobalErrorHandlers,
  ISSUES_URL,
} from '../../lib/error-reporting';

describe('error reporting', () => {
  beforeEach(() => {
    vi.mocked(window.electron.logRendererError).mockClear();
  });

  it('writes errors with their stack to the main log', () => {
    reportRendererError(new TypeError('boom'), 'test-source', 'at Component');

    expect(window.electron.logRendererError).toHaveBeenCalledWith({
      source: 'test-source',
      message: 'TypeError: boom',
      stack: expect.stringContaining('at Component'),
    });
  });

  it('accepts non-Error values', () => {
    reportRendererError('plain string', 'x');
    expect(window.electron.logRendererError).toHaveBeenCalledWith({
      source: 'x',
      message: 'plain string',
      stack: undefined,
    });
  });

  it('logs unhandled promise rejections once installed', () => {
    installGlobalErrorHandlers();
    installGlobalErrorHandlers(); // idempotent

    const event = new Event('unhandledrejection') as Event & {
      reason?: unknown;
    };
    event.reason = new Error('rejected');
    window.dispatchEvent(event);

    expect(window.electron.logRendererError).toHaveBeenCalledTimes(1);
    expect(window.electron.logRendererError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'unhandledrejection',
        message: 'Error: rejected',
      })
    );
  });

  it('swallows a failure to write the log', async () => {
    vi.mocked(window.electron.logRendererError).mockRejectedValueOnce(
      new Error('ipc closed')
    );

    expect(() => reportRendererError(new Error('boom'), 'x')).not.toThrow();

    // The write did fail; Vitest would flag the run if that rejection
    // escaped reportRendererError unhandled.
    const write = vi.mocked(window.electron.logRendererError).mock.results[0];
    await expect(write?.value).rejects.toThrow('ipc closed');
  });

  it('logs uncaught window errors with their Error once installed', () => {
    installGlobalErrorHandlers();

    window.dispatchEvent(
      new ErrorEvent('error', {
        error: new RangeError('out of range'),
        message: 'Uncaught RangeError: out of range',
      })
    );

    expect(window.electron.logRendererError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'window-error',
        message: 'RangeError: out of range',
      })
    );
  });

  it('falls back to the event message for window errors without an Error', () => {
    installGlobalErrorHandlers();

    window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }));

    expect(window.electron.logRendererError).toHaveBeenCalledWith({
      source: 'window-error',
      message: 'Script error.',
      stack: undefined,
    });
  });

  it('opens the bug report form with the environment fields filled in', () => {
    const url = new URL(
      buildIssueUrl(
        {
          version: 'v0.9.0',
          platform: 'linux',
          arch: 'x64',
          electron: '44.7.0',
          logsPath: '~/.config/Shoal/logs',
        },
        'Error: boom'
      )
    );
    const p = url.searchParams;

    expect(`${url.origin}${url.pathname}`).toBe(ISSUES_URL);
    expect(p.get('template')).toBe('bug_report.yml');
    expect(p.get('version')).toBe('v0.9.0');
    expect(p.get('os')).toBe('linux x64');
    expect(p.get('electron')).toBe('44.7.0');
    expect(p.get('logs')).toContain('~/.config/Shoal/logs');
    expect(p.get('what')).toContain('Error: boom');
  });

  it('still opens the form without app information or an error', () => {
    const p = new URL(buildIssueUrl(null)).searchParams;
    expect(p.get('template')).toBe('bug_report.yml');
    expect(p.get('version')).toBe('unknown');
    expect(p.get('os')).toBe('unknown');
    expect(p.has('logs')).toBe(false);
    expect(p.has('what')).toBe(false);
  });
});
