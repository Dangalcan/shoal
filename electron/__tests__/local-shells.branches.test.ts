/**
 * Branch coverage for local-shells: platform- and environment-dependent
 * detection paths that the real-environment spec (local-shells.test.ts)
 * cannot reach deterministically. fs is mocked and process.platform stubbed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { existsSync, mkdirSync } from 'fs';
import {
  getLocalShells,
  getDefaultShellId,
  resolveLocalShell,
  getTerminalCwd,
} from '../services/terminal/local-shells';

vi.mock('fs', () => {
  const fns = { existsSync: vi.fn(), mkdirSync: vi.fn() };
  return { ...fns, default: fns };
});

const mockExistsSync = vi.mocked(existsSync);
const mockMkdirSync = vi.mocked(mkdirSync);

const realPlatform = process.platform;

function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true,
  });
}

describe('local-shells (mocked environment branches)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    setPlatform(realPlatform);
    vi.unstubAllEnvs();
  });

  describe('windows detection', () => {
    beforeEach(() => setPlatform('win32'));

    it('returns only the built-in shells when nothing else is installed', () => {
      const ids = getLocalShells().map((s) => s.id);
      expect(ids).toEqual(['powershell', 'cmd']);
    });

    it('inserts pwsh after powershell when found in PATH', () => {
      // A delimiter-free dir: 'C:\\tools' contains ':', which is the POSIX
      // path.delimiter, so it splits into two entries on Linux CI runners and
      // the pwsh candidate is never matched.
      const dir = 'toolsdir';
      vi.stubEnv('PATH', dir);
      mockExistsSync.mockImplementation(
        (p) => p === path.join(dir, 'pwsh.exe')
      );

      const ids = getLocalShells().map((s) => s.id);
      expect(ids).toEqual(['powershell', 'pwsh', 'cmd']);
    });

    it('detects Git Bash from the LOCALAPPDATA candidate', () => {
      vi.stubEnv('LOCALAPPDATA', 'C:\\Users\\x\\AppData\\Local');
      const gitBash = path.join(
        'C:\\Users\\x\\AppData\\Local',
        'Programs',
        'Git',
        'bin',
        'bash.exe'
      );
      mockExistsSync.mockImplementation((p) => p === gitBash);

      const shells = getLocalShells();
      const bash = shells.find((s) => s.id === 'gitbash');
      expect(bash).toBeDefined();
      expect(bash!.family).toBe('unix');
      expect(resolveLocalShell('gitbash').file).toBe(gitBash);
    });

    it('detects WSL under WINDIR', () => {
      vi.stubEnv('WINDIR', 'D:\\Win');
      const wsl = path.join('D:\\Win', 'System32', 'wsl.exe');
      mockExistsSync.mockImplementation((p) => p === wsl);

      expect(getLocalShells().map((s) => s.id)).toContain('wsl');
    });

    it('defaults to the first detected shell', () => {
      expect(getDefaultShellId()).toBe('powershell');
    });
  });

  describe('unix detection', () => {
    beforeEach(() => setPlatform('linux'));

    it('falls back to /bin/sh alone when no other shell exists', () => {
      vi.stubEnv('PATH', '/usr/bin');
      const ids = getLocalShells().map((s) => s.id);
      expect(ids).toEqual(['sh']);
    });

    it('detects bash and zsh from PATH', () => {
      vi.stubEnv('PATH', '/usr/bin');
      mockExistsSync.mockImplementation(
        (p) =>
          p === path.join('/usr/bin', 'bash') ||
          p === path.join('/usr/bin', 'zsh')
      );

      const ids = getLocalShells().map((s) => s.id);
      expect(ids).toEqual(['bash', 'zsh', 'sh']);
    });

    it('detects bash and zsh from the /bin fallbacks when PATH is empty', () => {
      vi.stubEnv('PATH', '');
      mockExistsSync.mockImplementation(
        (p) => p === '/bin/bash' || p === '/bin/zsh'
      );

      const ids = getLocalShells().map((s) => s.id);
      expect(ids).toEqual(['bash', 'zsh', 'sh']);
    });

    it('prefers the shell named in $SHELL as the default', () => {
      vi.stubEnv('PATH', '/usr/bin');
      vi.stubEnv('SHELL', '/usr/bin/zsh');
      mockExistsSync.mockImplementation(
        (p) =>
          p === path.join('/usr/bin', 'bash') ||
          p === path.join('/usr/bin', 'zsh')
      );

      expect(getDefaultShellId()).toBe('zsh');
    });

    it('falls back to the first shell when $SHELL is not detected', () => {
      vi.stubEnv('PATH', '/usr/bin');
      vi.stubEnv('SHELL', '/usr/bin/fish');
      mockExistsSync.mockImplementation(
        (p) => p === path.join('/usr/bin', 'bash')
      );

      expect(getDefaultShellId()).toBe('bash');
    });

    it('falls back to the first shell when $SHELL is unset', () => {
      vi.stubEnv('PATH', '');
      vi.stubEnv('SHELL', '');
      expect(getDefaultShellId()).toBe('sh');
    });
  });

  describe('getTerminalCwd', () => {
    it('returns the dedicated dir when mkdir succeeds', () => {
      mockMkdirSync.mockReturnValue(undefined);
      expect(getTerminalCwd()).toBe(path.join(os.tmpdir(), 'shoal-terminal'));
    });

    it('falls back to the OS temp dir when mkdir fails', () => {
      mockMkdirSync.mockImplementation(() => {
        throw new Error('EACCES');
      });
      expect(getTerminalCwd()).toBe(os.tmpdir());
    });
  });
});
