import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';

vi.mock('../logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import log from '../logger';
import { redactForLog, wrapIpcHandler } from '../ipc/ipc-utils';

describe('redactForLog', () => {
  it('hides values under sensitive keys at any depth', () => {
    expect(
      redactForLog([
        'my-plugin',
        {
          pluginId: 'my-plugin',
          licenseKey: 'KD-SECRET',
          settings: { githubToken: 'ghp_x', refreshInterval: 30 },
          release: { values: 'password: hunter2' },
        },
      ])
    ).toEqual([
      'my-plugin',
      {
        pluginId: 'my-plugin',
        licenseKey: '[redacted]',
        settings: { githubToken: '[redacted]', refreshInterval: 30 },
        release: { values: '[redacted]' },
      },
    ]);
  });

  it('truncates long strings and very deep structures', () => {
    const long = 'x'.repeat(500);
    expect(redactForLog(long)).toBe(`${'x'.repeat(200)}... (500 chars)`);
    expect(redactForLog({ a: { b: { c: { d: { e: { f: 1 } } } } } })).toEqual({
      a: { b: { c: { d: { e: '[...]' } } } },
    });
  });
});

describe('wrapIpcHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('never logs a license key passed to a handler', async () => {
    const handler = wrapIpcHandler('activate-plugin-license', async () => true);
    await handler({} as IpcMainInvokeEvent, {
      pluginId: 'p',
      licenseKey: 'KD-SECRET-123',
    });

    const logged = vi
      .mocked(log.debug)
      .mock.calls.map((call) => call.join(' '))
      .join('\n');
    expect(logged).not.toContain('KD-SECRET-123');
    expect(logged).toContain('[redacted]');
  });
});
