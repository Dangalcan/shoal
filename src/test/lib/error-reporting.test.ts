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

  it('builds a GitHub issue URL with version, OS and the logs folder', () => {
    const url = new URL(
      buildIssueUrl(
        {
          version: 'v0.9.0',
          platform: 'linux',
          arch: 'x64',
          electron: '44.7.0',
          logsPath: '/home/ana/.config/Shoal/logs',
        },
        'Error: boom'
      )
    );
    const body = url.searchParams.get('body') ?? '';

    expect(`${url.origin}${url.pathname}`).toBe(ISSUES_URL);
    expect(body).toContain('Shoal: v0.9.0');
    expect(body).toContain('OS: linux x64');
    expect(body).toContain('/home/ana/.config/Shoal/logs');
    expect(body).toContain('Error: boom');
  });

  it('still builds a URL without app information', () => {
    const body = new URL(buildIssueUrl(null)).searchParams.get('body') ?? '';
    expect(body).toContain('Shoal: unknown');
  });
});
