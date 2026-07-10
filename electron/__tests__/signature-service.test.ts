import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => {
  const m = { readFile: vi.fn() };
  return { ...m, default: m };
});

vi.mock('crypto', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  const mocked = {
    ...actual,
    // Cast to any to avoid TypeScript overload conflict (verify has void callback overload)
    verify: vi.fn().mockReturnValue(false) as any,
    createVerify: vi.fn().mockReturnValue({ update: vi.fn(), end: vi.fn() }),
  };
  // Include default export so `import crypto from 'crypto'` resolves correctly
  return { ...mocked, default: mocked };
});

import fs from 'fs/promises';
import * as cryptoNs from 'crypto';
import { SignatureService } from '../services/security/signature-service';

// Typed helper: avoids TypeScript overload conflict on crypto.verify
const getVerifyMock = () =>
  vi.mocked(cryptoNs.verify as (...args: any[]) => boolean);

describe('SignatureService', () => {
  let service: SignatureService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish default false return (clearAllMocks only clears call history)
    getVerifyMock().mockReturnValue(false);
    service = new SignatureService();
  });

  describe('verifyPlugin', () => {
    it('should return false when manifest file cannot be read', async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );

      const result = await service.verifyPlugin('/fake/plugin/path');
      expect(result).toBe(false);
    });

    it('should return false for an unsigned plugin (no signature file) by default', async () => {
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('{"id":"test-plugin","version":"1.0.0"}')
        .mockRejectedValueOnce(
          Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
        );

      const result = await service.verifyPlugin('/fake/plugin/path');
      expect(result).toBe(false);
    });

    it('should return true for an unsigned plugin when ALLOW_UNSIGNED_PLUGINS=true', async () => {
      vi.stubEnv('ALLOW_UNSIGNED_PLUGINS', 'true');

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('{"id":"test-plugin","version":"1.0.0"}')
        .mockRejectedValueOnce(
          Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
        );

      const result = await service.verifyPlugin('/fake/plugin/path');
      expect(result).toBe(true);

      vi.unstubAllEnvs();
    });

    it('should return false when signature verification fails', async () => {
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('{"id":"test-plugin"}')
        .mockResolvedValueOnce('deadsig0000');

      getVerifyMock().mockReturnValue(false);

      const result = await service.verifyPlugin('/fake/plugin/path');
      expect(result).toBe(false);
    });

    it('should return true when signature verification succeeds', async () => {
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('{"id":"test-plugin"}')
        .mockResolvedValueOnce('validsig1234');

      getVerifyMock().mockReturnValue(true);

      const result = await service.verifyPlugin('/fake/plugin/path');
      expect(result).toBe(true);
    });

    it('verifies against MARKETPLACE_PUBLIC_KEY when set (rotation)', async () => {
      const overridePem =
        '-----BEGIN PUBLIC KEY-----\\nMARKETPLACEKEY\\n-----END PUBLIC KEY-----';
      vi.stubEnv('MARKETPLACE_PUBLIC_KEY', overridePem);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('{"id":"test-plugin"}')
        .mockResolvedValueOnce('somesig');
      getVerifyMock().mockReturnValue(true);

      const result = await service.verifyPlugin('/fake/plugin/path');
      expect(result).toBe(true);

      // The override key (with real newlines, not escaped) is used for verify.
      const keyArg = String(getVerifyMock().mock.calls[0][2]);
      expect(keyArg).toContain('MARKETPLACEKEY');
      expect(keyArg).toContain('\n');
      expect(keyArg).not.toContain('\\n');

      vi.unstubAllEnvs();
    });

    it('ignores a malformed MARKETPLACE_PUBLIC_KEY and uses the embedded key', async () => {
      vi.stubEnv('MARKETPLACE_PUBLIC_KEY', 'not-a-pem');
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('{"id":"test-plugin"}')
        .mockResolvedValueOnce('somesig');
      getVerifyMock().mockReturnValue(true);

      await service.verifyPlugin('/fake/plugin/path');
      const keyArg = String(getVerifyMock().mock.calls[0][2]);
      expect(keyArg).toContain('BEGIN PUBLIC KEY');
      expect(keyArg).not.toContain('not-a-pem');

      vi.unstubAllEnvs();
    });

    it('should return false when crypto.verify throws (e.g. bad key)', async () => {
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('{"id":"test-plugin"}')
        .mockResolvedValueOnce('badsig');

      getVerifyMock().mockImplementation(() => {
        throw new Error('invalid key format');
      });

      const result = await service.verifyPlugin('/fake/plugin/path');
      expect(result).toBe(false);
    });
  });
});
