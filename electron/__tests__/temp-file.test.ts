import { describe, it, expect, vi } from 'vitest';
import path from 'path';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/shoal-tests') },
}));

import { privateTempPath, PRIVATE_FILE_WRITE } from '../utils/temp-file';

describe('privateTempPath', () => {
  it('builds an unguessable name in the temp directory', () => {
    const a = privateTempPath('shoal-manifest', '.yaml');
    const b = privateTempPath('shoal-manifest', '.yaml');
    expect(a).not.toBe(b);
    expect(a).toMatch(/[\\/]shoal-manifest-[0-9a-f]{24}\.yaml$/);
    expect(path.dirname(a)).toBe(path.normalize('/tmp/shoal-tests'));
  });

  it('writes owner-only and never over an existing file', () => {
    expect(PRIVATE_FILE_WRITE).toEqual({
      encoding: 'utf-8',
      mode: 0o600,
      flag: 'wx',
    });
  });
});
