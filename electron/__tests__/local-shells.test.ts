import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import {
  findExecutable,
  getLocalShells,
  getDefaultShellId,
  resolveLocalShell,
  getTerminalCwd,
} from '../services/terminal/local-shells';

describe('local-shells', () => {
  it('detects at least one shell with id, label, and family', () => {
    const shells = getLocalShells();
    expect(shells.length).toBeGreaterThan(0);
    for (const shell of shells) {
      expect(shell.id).toBeTruthy();
      expect(shell.label).toBeTruthy();
      expect(['windows', 'unix']).toContain(shell.family);
    }
  });

  it('returns a default shell id that exists in the detected list', () => {
    const shells = getLocalShells();
    const defaultId = getDefaultShellId();
    expect(shells.map((s) => s.id)).toContain(defaultId);
  });

  it('resolves the default shell when no id is given', () => {
    const shell = resolveLocalShell();
    expect(shell.id).toBe(getDefaultShellId());
    expect(shell.file).toBeTruthy();
    expect(Array.isArray(shell.args)).toBe(true);
  });

  it('resolves every detected shell by id', () => {
    for (const info of getLocalShells()) {
      const shell = resolveLocalShell(info.id);
      expect(shell.id).toBe(info.id);
      expect(shell.family).toBe(info.family);
      expect(shell.file).toBeTruthy();
    }
  });

  it('rejects shell ids outside the allowlist', () => {
    expect(() => resolveLocalShell('not-a-shell')).toThrow(
      /Unknown or unavailable shell/
    );
    expect(() => resolveLocalShell('C:\\evil\\backdoor.exe')).toThrow(
      /Unknown or unavailable shell/
    );
    expect(() => resolveLocalShell('/bin/sh; rm -rf /')).toThrow(
      /Unknown or unavailable shell/
    );
  });

  it('finds a program on PATH by its bare name, with .exe on Windows', () => {
    const name = process.platform === 'win32' ? 'cmd' : 'sh';
    const found = findExecutable(name);
    expect(found).not.toBeNull();
    expect(path.isAbsolute(found!)).toBe(true);
    expect(existsSync(found!)).toBe(true);
    if (process.platform === 'win32') {
      expect(found!.toLowerCase().endsWith('cmd.exe')).toBe(true);
    }
    expect(findExecutable('shoal-no-such-program-xyz')).toBeNull();
  });

  it('returns the home directory as the terminal cwd', () => {
    const cwd = getTerminalCwd();
    expect(cwd).toBe(os.homedir());
    expect(path.isAbsolute(cwd)).toBe(true);
  });
});
