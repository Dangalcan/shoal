import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import {
  extractZipSafe,
  isPathInside,
  sha256File,
  verifyFileChecksum,
} from '../utils/fs-utils';

describe('fs-utils extraction & integrity (real fs)', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'k8sd-fsutils-'));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  describe('isPathInside', () => {
    it('accepts a child inside the parent', () => {
      expect(isPathInside('/a/b', '/a/b/c/d')).toBe(true);
      expect(isPathInside('/a/b', '/a/b')).toBe(true);
    });
    it('rejects traversal and siblings', () => {
      expect(isPathInside('/a/b', '/a/b/../c')).toBe(false);
      expect(isPathInside('/a/b', '/a/c')).toBe(false);
    });
  });

  describe('extractZipSafe', () => {
    it('extracts a normal archive preserving structure', async () => {
      const zip = new AdmZip();
      zip.addFile('index.js', Buffer.from('module.exports = 1;'));
      zip.addFile('sub/data.json', Buffer.from('{"ok":true}'));
      const zipPath = path.join(tmp, 'ok.zip');
      zip.writeZip(zipPath);

      const dest = path.join(tmp, 'out');
      await extractZipSafe(zipPath, dest);

      expect(await fs.readFile(path.join(dest, 'index.js'), 'utf8')).toContain(
        'module.exports'
      );
      expect(
        await fs.readFile(path.join(dest, 'sub', 'data.json'), 'utf8')
      ).toContain('ok');
    });

    // Zip-slip / traversal cases live in fs-utils-zipslip.test.ts, which
    // module-mocks adm-zip (AdmZip normalizes "../" when writing a real zip,
    // so a malicious archive cannot be produced with the real library).
  });

  describe('sha256File / verifyFileChecksum', () => {
    it('computes a stable digest and verifies a matching checksum', async () => {
      const file = path.join(tmp, 'a.bin');
      await fs.writeFile(file, 'hello world');
      const digest = await sha256File(file);
      // Known SHA-256 of "hello world"
      expect(digest).toBe(
        'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
      );
      await expect(verifyFileChecksum(file, digest)).resolves.toBeUndefined();
      await expect(
        verifyFileChecksum(file, `sha256:${digest}`)
      ).resolves.toBeUndefined();
    });

    it('throws on a checksum mismatch', async () => {
      const file = path.join(tmp, 'a.bin');
      await fs.writeFile(file, 'hello world');
      await expect(verifyFileChecksum(file, 'deadbeef')).rejects.toThrow(
        /mismatch/i
      );
    });
  });
});
