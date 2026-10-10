import { describe, it, expect } from 'vitest';
import { augmentPath, extraToolDirs } from '../utils/path-env';

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
