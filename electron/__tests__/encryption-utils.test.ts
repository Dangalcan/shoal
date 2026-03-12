import { describe, it, expect, vi } from 'vitest';

// Mock electron so app.getPath('userData') resolves without a real app.
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
}));

// Mock the synchronous fs module used by getOrCreateSalt().
// We return a stable, deterministic salt so the encryption key is consistent
// within a test run, without touching the real filesystem.
vi.mock('fs', () => {
  const mockSalt = 'a'.repeat(64); // 64 hex chars = 32 bytes
  return {
    default: {
      readFileSync: vi.fn(() => mockSalt),
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
    },
    readFileSync: vi.fn(() => mockSalt),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

// Mock node-machine-id so machineIdSync() returns a stable value.
vi.mock('node-machine-id', () => ({
  machineIdSync: vi.fn(() => 'test-machine-id-stable'),
}));

import { encrypt, decrypt } from '../services/security/encryption-utils';

describe('encryption-utils', () => {
  describe('encrypt', () => {
    it('should return a colon-separated hex string (IV:ciphertext)', () => {
      const result = encrypt('hello world');
      expect(typeof result).toBe('string');
      expect(result).toContain(':');
      const parts = result.split(':');
      expect(parts).toHaveLength(2);
      // IV is 16 bytes = 32 hex chars
      expect(parts[0]).toMatch(/^[0-9a-f]{32}$/i);
      // Ciphertext is non-empty hex
      expect(parts[1]).toMatch(/^[0-9a-f]+$/i);
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

    it('should handle multi-colon encrypted values correctly', () => {
      // The decrypt implementation joins remaining parts with ':' after shifting the IV.
      // Verify this path works (the ciphertext itself won't contain a colon,
      // but the implementation is defensive via textParts.join(':'))
      const original = 'test-value';
      const encrypted = encrypt(original);
      expect(decrypt(encrypted)).toBe(original);
    });

    it('should return empty string for invalid ciphertext hex', () => {
      // 32 hex chars for IV + invalid ciphertext → decipher.final() will throw
      const result = decrypt('0'.repeat(32) + ':invalidhex!!');
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

    it('should return empty string when IV part is invalid hex', () => {
      const result = decrypt('GGGG:abcd1234');
      expect(result).toBe('');
    });
  });
});
