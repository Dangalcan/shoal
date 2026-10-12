import { describe, it, expect, vi } from 'vitest';

vi.mock('../logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  getLogsDirectory: vi.fn(() => '/home/ana/.config/Shoal/logs'),
}));
vi.mock('electron', () => ({
  app: { getVersion: vi.fn(() => '0.9.0') },
  ipcMain: { handle: vi.fn() },
  shell: { openPath: vi.fn() },
}));

import { tildify } from '../ipc/app-ipc';

describe('tildify', () => {
  it('replaces the home folder with ~ on POSIX and Windows paths', () => {
    expect(tildify('/home/ana/.config/Shoal/logs', '/home/ana')).toBe(
      '~/.config/Shoal/logs'
    );
    expect(
      tildify('C:\\Users\\ana\\AppData\\Roaming\\Shoal\\logs', 'C:\\Users\\ana')
    ).toBe('~\\AppData\\Roaming\\Shoal\\logs');
    expect(tildify('/home/ana', '/home/ana')).toBe('~');
  });

  it('leaves paths outside the home folder alone', () => {
    expect(tildify('/var/log/shoal', '/home/ana')).toBe('/var/log/shoal');
    // A sibling folder that merely starts with the same characters.
    expect(tildify('/home/anabel/logs', '/home/ana')).toBe('/home/anabel/logs');
    expect(tildify('/home/ana/logs', '')).toBe('/home/ana/logs');
  });
});
