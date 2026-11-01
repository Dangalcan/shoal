import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  applyDesktopToolPath,
  augmentPath,
  extraToolDirs,
} from '../utils/path-env';

describe('extraToolDirs', () => {
  it('lists the usual Linux tool directories under the home folder', () => {
    const dirs = extraToolDirs('linux', '/home/ana');
    expect(dirs).toContain('/usr/local/bin');
    expect(dirs).toContain('/snap/bin');
    expect(dirs).toContain('/home/ana/.local/bin');
    expect(dirs).toContain('/home/ana/.krew/bin');
  });

  it('adds Homebrew on macOS and nothing on Windows', () => {
    expect(extraToolDirs('darwin', '/Users/ana')).toContain(
      '/opt/homebrew/bin'
    );
    expect(extraToolDirs('win32', 'C:/Users/ana')).toEqual([]);
  });
});

describe('augmentPath', () => {
  const exists = (dir: string) => dir !== '/missing';

  it('appends existing directories that are not already there', () => {
    expect(
      augmentPath('/usr/bin:/bin', ['/usr/local/bin', '/missing'], exists, ':')
    ).toBe('/usr/bin:/bin:/usr/local/bin');
  });

  it('keeps existing entries first and never duplicates them', () => {
    expect(
      augmentPath('/usr/local/bin:/usr/bin', ['/usr/local/bin'], exists, ':')
    ).toBe('/usr/local/bin:/usr/bin');
  });

  it('builds a PATH from scratch when the current one is empty', () => {
    expect(augmentPath('', ['/snap/bin'], exists, ':')).toBe('/snap/bin');
  });
});

describe('applyDesktopToolPath', () => {
  const originalPath = process.env.PATH;
  const originalPlatform = process.platform;
  let home: string;

  const setPlatform = (value: NodeJS.Platform) =>
    Object.defineProperty(process, 'platform', { value, configurable: true });

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-path-env-'));
    fs.mkdirSync(path.posix.join(home, '.local/bin'), { recursive: true });
    vi.spyOn(os, 'homedir').mockReturnValue(home);
    setPlatform('linux');
  });

  afterEach(() => {
    setPlatform(originalPlatform);
    vi.restoreAllMocks();
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('appends the tool folders that exist after the current PATH', () => {
    const current = ['first-dir', 'second-dir'].join(path.delimiter);
    process.env.PATH = current;

    applyDesktopToolPath();

    const entries = process.env.PATH!.split(path.delimiter);
    expect(entries.slice(0, 2)).toEqual(['first-dir', 'second-dir']);
    expect(entries).toContain(path.posix.join(home, '.local/bin'));
    // Folders that do not exist under the home are not added.
    expect(entries).not.toContain(path.posix.join(home, 'go/bin'));
  });

  it('builds the PATH from scratch when none is set', () => {
    delete process.env.PATH;

    applyDesktopToolPath();

    expect(process.env.PATH!.split(path.delimiter)).toContain(
      path.posix.join(home, '.local/bin')
    );
  });

  it('adds nothing on Windows', () => {
    setPlatform('win32');
    process.env.PATH = 'only-dir';

    applyDesktopToolPath();

    expect(process.env.PATH).toBe('only-dir');
  });
});
