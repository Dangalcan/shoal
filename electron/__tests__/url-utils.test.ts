import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  shell: { openExternal: vi.fn().mockResolvedValue(undefined) },
}));

import { shell } from 'electron';
import { assertExternalUrl, openExternalSafe } from '../utils/url-utils';

describe('external URLs', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['https://github.com/Dangalcan/shoal', 'http://localhost:8080/x'])(
    'opens %s in the system browser',
    async (url) => {
      await openExternalSafe(url);
      expect(shell.openExternal).toHaveBeenCalledWith(new URL(url).toString());
    }
  );

  it.each([
    'file:///C:/Users/me/.kube/config',
    'javascript:alert(1)',
    'plugin-file://local/etc/passwd',
    'not a url',
  ])('refuses %s', async (url) => {
    expect(() => assertExternalUrl(url)).toThrow();
    await expect(openExternalSafe(url)).rejects.toThrow();
    expect(shell.openExternal).not.toHaveBeenCalled();
  });
});
