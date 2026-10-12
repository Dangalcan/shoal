import { describe, it, expect } from 'vitest';
import {
  SIGNATURE_FORMAT,
  compareFiles,
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
