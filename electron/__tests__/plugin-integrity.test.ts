import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  SIGNATURE_FORMAT,
  compareFiles,
  hashPluginFiles,
  isSafeRelativePath,
  parseSignatureFile,
} from '../services/security/plugin-integrity';

describe('isSafeRelativePath', () => {
  it('accepts plain relative POSIX paths', () => {
    expect(isSafeRelativePath('index.js')).toBe(true);
    expect(isSafeRelativePath('data/default-config.json')).toBe(true);
  });

  it('refuses control characters, backslashes and escapes', () => {
    expect(isSafeRelativePath('a\nb.js')).toBe(false);
    expect(isSafeRelativePath('dir\\x.js')).toBe(false);
    expect(isSafeRelativePath('/etc/passwd')).toBe(false);
    expect(isSafeRelativePath('../x.js')).toBe(false);
    expect(isSafeRelativePath('a//b')).toBe(false);
    expect(isSafeRelativePath('')).toBe(false);
  });
});

describe('parseSignatureFile', () => {
  const valid = {
    format: SIGNATURE_FORMAT,
    files: { 'index.js': 'ab'.repeat(32) },
    signature: 'deadbeef',
  };

  it('accepts a well-formed signature', () => {
    expect(parseSignatureFile(JSON.stringify(valid))).toEqual(valid);
  });

  it('refuses file names that could forge the signed payload', () => {
    const forged = {
      ...valid,
      files: { 'index.js\n1234  evil.js': 'ab'.repeat(32) },
    };
    expect(() => parseSignatureFile(JSON.stringify(forged))).toThrow(
      /invalid file name/
    );
    expect(() =>
      parseSignatureFile(
        JSON.stringify({ ...valid, files: { 'index.js': 42 } })
      )
    ).toThrow(/invalid file name/);
  });
});

describe('compareFiles', () => {
  it('looks at own entries only', () => {
    const signed = { 'index.js': 'a' };
    // "constructor" lives on Object.prototype: never a signed file.
    expect(compareFiles(signed, { 'index.js': 'a', constructor: 'x' })).toEqual(
      ['unexpected constructor']
    );
    expect(compareFiles({ constructor: 'x' }, {})).toEqual([
      'missing constructor',
    ]);
  });
});

describe('parseSignatureFile structure', () => {
  it('refuses another signature format', () => {
    expect(() =>
      parseSignatureFile(
        JSON.stringify({
          format: 'shoal-plugin-signature/1',
          files: {},
          signature: 'ab',
        })
      )
    ).toThrow('Unsupported signature format: shoal-plugin-signature/1');
  });

  it.each([
    ['no file list', { format: SIGNATURE_FORMAT, signature: 'ab' }],
    [
      'a file list that is not an object',
      { format: SIGNATURE_FORMAT, files: 'index.js', signature: 'ab' },
    ],
    ['no signature', { format: SIGNATURE_FORMAT, files: {} }],
  ])('refuses a signature with %s', (_label, content) => {
    expect(() => parseSignatureFile(JSON.stringify(content))).toThrow(
      'plugin.json.sig is missing its file list or signature'
    );
  });
});

describe('hashPluginFiles', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-integrity-'));
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};\n');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('refuses a plugin containing a symbolic link', async (ctx) => {
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'shoal-outside-'));
    try {
      try {
        fs.symlinkSync(target, path.join(dir, 'link'), 'junction');
      } catch {
        ctx.skip(); // no symlink rights on this machine
      }
      await expect(hashPluginFiles(dir)).rejects.toThrow(
        'Symbolic links are not allowed in plugins: link'
      );
    } finally {
      fs.rmSync(path.join(dir, 'link'), { force: true, recursive: false });
      fs.rmSync(target, { recursive: true, force: true });
    }
  });
});
