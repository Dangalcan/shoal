import { existsSync, statSync } from 'fs';
import os from 'os';
import path from 'path';

export type ShellFamily = 'windows' | 'unix';

export interface LocalShellInfo {
  id: string;
  label: string;
  family: ShellFamily;
}

export interface ResolvedLocalShell extends LocalShellInfo {
  file: string;
  args: string[];
}

function findInPath(exe: string): string | null {
  const pathVar = process.env.PATH || '';
  for (const dir of pathVar.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, exe);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function firstExisting(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function detectWindowsShells(): ResolvedLocalShell[] {
  const shells: ResolvedLocalShell[] = [
    // Always present on Windows; spawn resolves them through PATH.
    {
      id: 'powershell',
      label: 'PowerShell',
      family: 'windows',
      file: 'powershell.exe',
      args: ['-NoLogo'],
    },
    {
      id: 'cmd',
      label: 'Command Prompt',
      family: 'windows',
      file: 'cmd.exe',
      args: [],
    },
  ];

  const pwsh = findInPath('pwsh.exe');
  if (pwsh) {
    shells.splice(1, 0, {
      id: 'pwsh',
      label: 'PowerShell 7',
      family: 'windows',
      file: pwsh,
      args: ['-NoLogo'],
    });
  }

  const localAppData = process.env.LOCALAPPDATA;
  const gitBash = firstExisting([
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    ...(localAppData
      ? [path.join(localAppData, 'Programs', 'Git', 'bin', 'bash.exe')]
      : []),
  ]);
  if (gitBash) {
    shells.push({
      id: 'gitbash',
      label: 'Git Bash',
      family: 'unix',
      file: gitBash,
      args: ['-i'],
    });
  }

  const windir = process.env.WINDIR || 'C:\\Windows';
  const wsl = path.join(windir, 'System32', 'wsl.exe');
  if (existsSync(wsl)) {
    shells.push({
      id: 'wsl',
      label: 'WSL',
      family: 'unix',
      file: wsl,
      args: [],
    });
  }

  return shells;
}

function detectUnixShells(): ResolvedLocalShell[] {
  const shells: ResolvedLocalShell[] = [];

  const bash = findInPath('bash') || firstExisting(['/bin/bash']);
  if (bash) {
    shells.push({
      id: 'bash',
      label: 'Bash',
      family: 'unix',
      file: bash,
      args: ['-i'],
    });
  }

  const zsh = findInPath('zsh') || firstExisting(['/bin/zsh']);
  if (zsh) {
    shells.push({
      id: 'zsh',
      label: 'Zsh',
      family: 'unix',
      file: zsh,
      args: ['-i'],
    });
  }

  // /bin/sh is the POSIX fallback and guarantees a non-empty list.
  shells.push({
    id: 'sh',
    label: 'sh',
    family: 'unix',
    file: '/bin/sh',
    args: ['-i'],
  });

  return shells;
}

function detectLocalShells(): ResolvedLocalShell[] {
  return process.platform === 'win32'
    ? detectWindowsShells()
    : detectUnixShells();
}

export function getLocalShells(): LocalShellInfo[] {
  return detectLocalShells().map(({ id, label, family }) => ({
    id,
    label,
    family,
  }));
}

export function getDefaultShellId(): string {
  const shells = detectLocalShells();
  if (process.platform !== 'win32') {
    const userShell = path.basename(process.env.SHELL || '');
    const match = shells.find((s) => s.id === userShell);
    if (match) return match.id;
  }
  return shells[0].id;
}

/**
 * Resolves a shell id (or the default when omitted) to a spawnable
 * executable. Only shells from the detected allowlist are accepted —
 * arbitrary executables from the renderer are rejected.
 */
export function resolveLocalShell(shellId?: string): ResolvedLocalShell {
  const shells = detectLocalShells();
  const id = shellId || getDefaultShellId();
  const shell = shells.find((s) => s.id === id);
  if (!shell) {
    throw new Error(`Unknown or unavailable shell: ${id}`);
  }
  return shell;
}

/**
 * Default working directory for local terminals: the user's home, like any
 * terminal. Never the app installation directory (stray commands must not
 * touch application files) and not a folder in the shared temp directory,
 * which another user of the machine could own first.
 */
export function getTerminalCwd(): string {
  try {
    const home = os.homedir();
    if (home && statSync(home).isDirectory()) return home;
  } catch {
    // No usable home directory: fall through.
  }
  return os.tmpdir();
}
