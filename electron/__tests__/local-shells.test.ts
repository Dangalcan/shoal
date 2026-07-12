import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import {
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

  it('returns a terminal cwd inside the OS temp directory and creates it', () => {
    const cwd = getTerminalCwd();
    expect(cwd.startsWith(os.tmpdir())).toBe(true);
    expect(existsSync(cwd)).toBe(true);
    expect(path.isAbsolute(cwd)).toBe(true);
  });
});
