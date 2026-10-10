import { existsSync } from 'fs';
import os from 'os';
import path from 'path';

/**
 * Directories where kubectl, kind, helm and friends usually live but that
 * desktop launchers (AppImage, .desktop entries, Finder) leave out of PATH,
 * because they do not read the user's shell profile. Windows installers add
 * themselves to the user PATH, so nothing is added there.
 */
export function extraToolDirs(
  platform: NodeJS.Platform,
  home: string
): string[] {
  if (platform === 'linux') {
    return [
      '/usr/local/bin',
      '/snap/bin',
      path.posix.join(home, '.local/bin'),
      path.posix.join(home, 'bin'),
      path.posix.join(home, 'go/bin'),
      '/home/linuxbrew/.linuxbrew/bin',
      path.posix.join(home, '.krew/bin'),
      path.posix.join(home, '.rd/bin'),
    ];
  }
  if (platform === 'darwin') {
    return [
      '/opt/homebrew/bin',
      '/usr/local/bin',
      path.posix.join(home, '.krew/bin'),
      path.posix.join(home, '.rd/bin'),
    ];
  }
  return [];
}

/**
 * Appends `dirs` that exist and are not already present to a PATH string.
 * Existing entries keep their order and priority.
 */
export function augmentPath(
  current: string,
  dirs: string[],
  exists: (dir: string) => boolean,
  delimiter: string = path.delimiter
): string {
  const entries = current.split(delimiter).filter(Boolean);
  for (const dir of dirs) {
    if (!entries.includes(dir) && exists(dir)) entries.push(dir);
  }
  return entries.join(delimiter);
}

/**
 * Extends process.env.PATH once at startup. Every child process (safe-exec,
 * terminal, port-forward, plugin hosts) inherits it.
 */
export function applyDesktopToolPath(): void {
  process.env.PATH = augmentPath(
    process.env.PATH ?? '',
    extraToolDirs(process.platform, os.homedir()),
    existsSync
  );
}
