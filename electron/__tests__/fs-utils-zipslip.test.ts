// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Module-mock adm-zip: a real archive can't hold a "../" entry (AdmZip
// normalizes it on write), so we inject crafted malicious entries here.
const { getEntries } = vi.hoisted(() => ({ getEntries: vi.fn() }));
vi.mock('adm-zip', () => {
  function MockAdmZip(_p: string) {}
  MockAdmZip.prototype.getEntries = getEntries;
  return { default: MockAdmZip };
});

import { extractZipSafe } from '../utils/fs-utils';

function entry(entryName: string, isDirectory = false) {
  return {
    entryName,
    isDirectory,
    getData: () => Buffer.from('pwned'),
  };
}

describe('extractZipSafe — zip-slip protection', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'k8sd-zipslip-'));
    getEntries.mockReset();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('blocks a "../" traversal entry and writes nothing outside dest', async () => {
    getEntries.mockReturnValue([entry('good.txt'), entry('../evil.txt')]);
    const dest = path.join(tmp, 'out');

    await expect(extractZipSafe('ignored.zip', dest)).rejects.toThrow(
      /zip-slip/i
    );
    await expect(fs.access(path.join(tmp, 'evil.txt'))).rejects.toThrow();
  });

  it('blocks an absolute-path entry', async () => {
    const outside = path.join(tmp, 'outside.txt');
    getEntries.mockReturnValue([entry(outside)]);
    const dest = path.join(tmp, 'out');

    await expect(extractZipSafe('ignored.zip', dest)).rejects.toThrow(
      /zip-slip/i
    );
    await expect(fs.access(outside)).rejects.toThrow();
  });

  it('rejects the whole archive before writing any file when one entry is malicious', async () => {
    getEntries.mockReturnValue([entry('a.txt'), entry('../b.txt')]);
    const dest = path.join(tmp, 'out');

    await expect(extractZipSafe('ignored.zip', dest)).rejects.toThrow();
    // Validation happens in a first pass, so even the benign a.txt is not written.
    await expect(fs.access(path.join(dest, 'a.txt'))).rejects.toThrow();
  });

  it('extracts nested entries that stay within dest', async () => {
    getEntries.mockReturnValue([entry('sub', true), entry('sub/ok.txt')]);
    const dest = path.join(tmp, 'out');

    await extractZipSafe('ignored.zip', dest);
    expect(await fs.readFile(path.join(dest, 'sub', 'ok.txt'), 'utf8')).toBe(
      'pwned'
    );
  });
});
