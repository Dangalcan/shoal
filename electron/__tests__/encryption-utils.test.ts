import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Mock electron so app.getPath('userData') resolves without a real app.
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
}));

// Mock the synchronous fs module used by getOrCreateSalt().
// Mutable, hoisted fn refs so individual tests can change fs behaviour and have
// it apply to a freshly re-imported module (via vi.resetModules).
const fsMock = vi.hoisted(() => ({
  readFileSync: vi.fn(() => 'a'.repeat(64)), // 64 hex chars = 32 bytes
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));
vi.mock('fs', () => ({ default: fsMock, ...fsMock }));

// Mock node-machine-id so machineIdSync() returns a stable value.
vi.mock('node-machine-id', () => ({
  machineIdSync: vi.fn(() => 'test-machine-id-stable'),
}));

// Mock the logger to avoid electron-log re-initialisation across resetModules.
vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  encrypt,
  decrypt,
  isLegacyCBC,
} from '../services/security/encryption-utils';

describe('encryption-utils', () => {
  describe('encrypt', () => {
    it('should return a colon-separated hex string (IV:authTag:ciphertext)', () => {
      const result = encrypt('hello world');
      expect(typeof result).toBe('string');
      const parts = result.split(':');
      expect(parts).toHaveLength(3);
      // GCM IV is 12 bytes = 24 hex chars
      expect(parts[0]).toMatch(/^[0-9a-f]{24}$/i);
      // Auth tag is 16 bytes = 32 hex chars
      expect(parts[1]).toMatch(/^[0-9a-f]{32}$/i);
      // Ciphertext is non-empty hex
      expect(parts[2]).toMatch(/^[0-9a-f]+$/i);
    });

    it('should produce a different ciphertext on each call due to random IV', () => {
      const a = encrypt('same text');
      const b = encrypt('same text');
      // Different IVs → different output even for the same plaintext
      expect(a).not.toBe(b);
    });

    it('should encrypt an empty string without throwing', () => {
      expect(() => encrypt('')).not.toThrow();
    });
  });

  describe('decrypt', () => {
    it('should round-trip: decrypt(encrypt(text)) === text', () => {
      const original = 'my-super-secret-license-key-XYZ-9999';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should handle GCM three-part format correctly', () => {
      const original = 'test-value';
      const encrypted = encrypt(original);
      expect(encrypted.split(':')).toHaveLength(3);
      expect(decrypt(encrypted)).toBe(original);
    });

    it('should return empty string for invalid ciphertext (bad auth tag)', () => {
      // 24 hex chars for IV + 32 hex chars for authTag + invalid ciphertext → throws
      const result = decrypt(
        '0'.repeat(24) + ':' + '0'.repeat(32) + ':invalidhex!!'
      );
      expect(result).toBe('');
    });

    it('should return empty string for fully malformed input (no colon)', () => {
      const result = decrypt('nodividerhere');
      expect(result).toBe('');
    });

    it('should return empty string for empty string input', () => {
      const result = decrypt('');
      expect(result).toBe('');
    });

    it('should return empty string when auth tag verification fails', () => {
      const encrypted = encrypt('secret');
      const parts = encrypted.split(':');
      // Corrupt the auth tag
      parts[1] = 'ff'.repeat(16);
      const result = decrypt(parts.join(':'));
      expect(result).toBe('');
    });
  });

  describe('decrypt – legacy CBC', () => {
    // Key derivation is deterministic under the mocks above.
    const key = crypto.scryptSync('test-machine-id-stable', 'a'.repeat(64), 32);

    it('decrypts a legacy CBC (iv:ciphertext) value', () => {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      const ct = Buffer.concat([
        cipher.update('legacy-secret'),
        cipher.final(),
      ]);
      const value = iv.toString('hex') + ':' + ct.toString('hex');
      expect(decrypt(value)).toBe('legacy-secret');
    });

    it('returns empty string for a two-part value with a bad IV length', () => {
      expect(decrypt('00:00')).toBe('');
    });
  });

  describe('isLegacyCBC', () => {
    it('is true for a two-part value, false otherwise', () => {
      expect(isLegacyCBC('aa:bb')).toBe(true);
      expect(isLegacyCBC('aa:bb:cc')).toBe(false);
      expect(isLegacyCBC('nodivider')).toBe(false);
    });
  });

  describe('getOrCreateSalt – persistence', () => {
    beforeEach(() => {
      vi.resetModules();
      // Reset fs mock impls to defaults before each test.
      fsMock.readFileSync.mockReset();
      fsMock.writeFileSync.mockReset();
      fsMock.mkdirSync.mockReset();
      fsMock.readFileSync.mockReturnValue('a'.repeat(64));
    });

    it('creates and persists a new salt when none exists', async () => {
      fsMock.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const mod = await import('../services/security/encryption-utils');
      mod.encrypt('x'); // triggers getEncryptionKey → getOrCreateSalt
      expect(fsMock.mkdirSync).toHaveBeenCalled();
      expect(fsMock.writeFileSync).toHaveBeenCalled();
    });

    it('creates a new salt when the stored one is too short', async () => {
      fsMock.readFileSync.mockReturnValue('short');
      const mod = await import('../services/security/encryption-utils');
      mod.encrypt('x');
      expect(fsMock.writeFileSync).toHaveBeenCalled();
    });

    it('does not throw when the salt cannot be persisted', async () => {
      fsMock.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      fsMock.writeFileSync.mockImplementation(() => {
        throw new Error('EACCES');
      });
      const mod = await import('../services/security/encryption-utils');
      expect(() => mod.encrypt('x')).not.toThrow();
    });
  });
});
