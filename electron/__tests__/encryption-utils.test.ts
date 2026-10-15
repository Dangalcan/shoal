import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Mock electron: app.getPath('userData') resolves without a real app, and
// safeStorage is a stand-in keystore that "wraps" a string with a prefix. The
// keystore is unavailable by default, so most tests run the machine-bound
// path; the keystore tests opt in.
const electronMock = vi.hoisted(() => {
  const WRAP = 'wrapped:';
  return {
    app: { getPath: vi.fn(() => '/mock/user/data') },
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => false),
      encryptString: vi.fn((plain: string) => Buffer.from(WRAP + plain)),
      decryptString: vi.fn((wrapped: Buffer) => {
        const text = wrapped.toString();
        if (!text.startsWith(WRAP)) throw new Error('Not wrapped by this key');
        return text.slice(WRAP.length);
      }),
    },
  };
});
vi.mock('electron', () => electronMock);

// Mock the synchronous fs module used for the salt and the wrapped key.
// Mutable, hoisted fn refs so individual tests can change fs behaviour and have
// it apply to a freshly re-imported module (via vi.resetModules).
const fsMock = vi.hoisted(() => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));
vi.mock('fs', () => ({ default: fsMock, ...fsMock }));

const SALT = 'a'.repeat(64); // 64 hex chars = 32 bytes
const enoent = () => Object.assign(new Error('ENOENT'), { code: 'ENOENT' });

/** Default disk: a salt file exists, nothing else does. */
function defaultDisk(): void {
  fsMock.readFileSync.mockImplementation((file: string) => {
    if (file.endsWith('.encryption-salt')) return SALT;
    throw enoent();
  });
}
defaultDisk();

// Mock node-machine-id so machineIdSync() returns a stable value.
const machineIdMock = vi.hoisted(() => ({
  machineIdSync: vi.fn(() => 'test-machine-id-stable'),
}));
vi.mock('node-machine-id', () => machineIdMock);

// Mock the logger to avoid electron-log re-initialisation across resetModules.
const logMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock('../logger', () => ({ default: logMock }));

import {
  encrypt,
  decrypt,
  isLegacyCBC,
  usesCurrentScheme,
} from '../services/security/encryption-utils';

// Key derivation of the machine-bound scheme is deterministic under the mocks.
const machineKey = crypto.scryptSync('test-machine-id-stable', SALT, 32);

function gcmWith(key: Buffer, text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(text), cipher.final()]);
  return [iv, cipher.getAuthTag(), ct].map((b) => b.toString('hex')).join(':');
}

function cbcWith(key: Buffer, text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const ct = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString('hex') + ':' + ct.toString('hex');
}

type EncryptionModule = typeof import('../services/security/encryption-utils');

/** A fresh module instance (its cached keys start empty). */
async function freshModule(): Promise<EncryptionModule> {
  vi.resetModules();
  return import('../services/security/encryption-utils');
}

const keyFileWrites = () =>
  fsMock.writeFileSync.mock.calls.filter(([file]) =>
    String(file).endsWith('.encryption-key')
  );

describe('encryption-utils', () => {
  describe('encrypt (machine-bound, no keystore)', () => {
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

    it('reports the machine-bound value as the current scheme', () => {
      expect(usesCurrentScheme(encrypt('x'))).toBe(true);
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
    it('decrypts a legacy CBC (iv:ciphertext) value', () => {
      expect(decrypt(cbcWith(machineKey, 'legacy-secret'))).toBe(
        'legacy-secret'
      );
    });

    it('returns empty string for a two-part value with a bad IV length', () => {
      expect(decrypt('00:00')).toBe('');
    });

    it('is not the current scheme', () => {
      expect(usesCurrentScheme(cbcWith(machineKey, 'x'))).toBe(false);
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
      // Reset fs mock impls to defaults before each test.
      fsMock.readFileSync.mockReset();
      fsMock.writeFileSync.mockReset();
      fsMock.mkdirSync.mockReset();
      defaultDisk();
    });

    it('creates and persists a new salt when none exists', async () => {
      fsMock.readFileSync.mockImplementation(() => {
        throw enoent();
      });
      const mod = await freshModule();
      mod.encrypt('x'); // triggers getMachineKey → getOrCreateSalt
      expect(fsMock.mkdirSync).toHaveBeenCalled();
      expect(fsMock.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.encryption-salt'),
        expect.stringMatching(/^[0-9a-f]{64}$/),
        { mode: 0o600 }
      );
    });

    it('creates a new salt when the stored one is too short', async () => {
      fsMock.readFileSync.mockReturnValue('short');
      const mod = await freshModule();
      mod.encrypt('x');
      expect(fsMock.writeFileSync).toHaveBeenCalled();
    });

    it('does not throw when the salt cannot be persisted', async () => {
      fsMock.readFileSync.mockImplementation(() => {
        throw enoent();
      });
      fsMock.writeFileSync.mockImplementation(() => {
        throw new Error('EACCES');
      });
      const mod = await freshModule();
      expect(() => mod.encrypt('x')).not.toThrow();
    });
  });

  describe('keystore-wrapped data key (safeStorage available)', () => {
    const { safeStorage } = electronMock;

    beforeEach(() => {
      fsMock.readFileSync.mockReset();
      fsMock.writeFileSync.mockReset();
      fsMock.mkdirSync.mockReset();
      defaultDisk();
      safeStorage.isEncryptionAvailable.mockReset();
      safeStorage.isEncryptionAvailable.mockReturnValue(true);
      safeStorage.encryptString.mockClear();
      safeStorage.decryptString.mockClear();
      machineIdMock.machineIdSync.mockClear();
      logMock.info.mockClear();
      logMock.warn.mockClear();
      logMock.error.mockClear();
    });

    /** Puts a wrapped 32-byte key on the mock disk and returns the raw key. */
    function keyFileOnDisk(key = crypto.randomBytes(32)): Buffer {
      const wrapped = safeStorage
        .encryptString(key.toString('base64'))
        .toString('base64');
      safeStorage.encryptString.mockClear();
      fsMock.readFileSync.mockImplementation((file: string) => {
        if (file.endsWith('.encryption-salt')) return SALT;
        if (file.endsWith('.encryption-key')) return wrapped + '\n';
        throw enoent();
      });
      return key;
    }

    it('creates the wrapped key owner-only and writes v2 values', async () => {
      const mod = await freshModule();
      const value = mod.encrypt('secret');

      const parts = value.split(':');
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe('v2');
      expect(parts[1]).toMatch(/^[0-9a-f]{24}$/);
      expect(parts[2]).toMatch(/^[0-9a-f]{32}$/);
      expect(mod.decrypt(value)).toBe('secret');
      expect(mod.usesCurrentScheme(value)).toBe(true);

      // One key file, owner-only, holding exactly what the keystore returned.
      const writes = keyFileWrites();
      expect(writes).toHaveLength(1);
      const [, content, options] = writes[0];
      expect(options).toEqual({ mode: 0o600 });
      expect(safeStorage.encryptString).toHaveBeenCalledTimes(1);
      const rawKeyBase64 = safeStorage.encryptString.mock.calls[0][0];
      expect(Buffer.from(rawKeyBase64, 'base64')).toHaveLength(32);
      expect(content).toBe(
        safeStorage.encryptString.mock.results[0].value.toString('base64')
      );
      // The raw key is only inside the wrapper, never the file content.
      expect(content).not.toBe(rawKeyBase64);
      expect(String(content)).not.toContain(rawKeyBase64);
      expect(logMock.info).toHaveBeenCalledWith(
        expect.stringContaining('Created the keystore-wrapped data key')
      );
      // The machine id is not needed on this path.
      expect(machineIdMock.machineIdSync).not.toHaveBeenCalled();
    });

    it('reuses the wrapped key from disk', async () => {
      const key = keyFileOnDisk();
      const mod = await freshModule();

      const value = mod.encrypt('secret');
      expect(safeStorage.decryptString).toHaveBeenCalledTimes(1);
      expect(keyFileWrites()).toHaveLength(0);
      // The value is readable with the key that was on disk…
      const [, iv, tag, ct] = value.split(':');
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      expect(
        Buffer.concat([
          decipher.update(Buffer.from(ct, 'hex')),
          decipher.final(),
        ]).toString()
      ).toBe('secret');
      // …and the module reads a value written with it.
      expect(mod.decrypt('v2:' + gcmWith(key, 'from-last-run'))).toBe(
        'from-last-run'
      );
    });

    it('still reads machine-bound and CBC values and marks them for re-encryption', async () => {
      const mod = await freshModule();
      const gcm = gcmWith(machineKey, 'old-gcm');
      const cbc = cbcWith(machineKey, 'old-cbc');

      expect(mod.decrypt(gcm)).toBe('old-gcm');
      expect(mod.decrypt(cbc)).toBe('old-cbc');
      expect(mod.usesCurrentScheme(gcm)).toBe(false);
      expect(mod.usesCurrentScheme(cbc)).toBe(false);
      // Re-encrypting moves the value to the keystore key.
      const migrated = mod.encrypt(mod.decrypt(gcm));
      expect(migrated.startsWith('v2:')).toBe(true);
      expect(mod.usesCurrentScheme(migrated)).toBe(true);
    });

    it('detects tampering with a v2 value', async () => {
      const mod = await freshModule();
      const value = mod.encrypt('secret');
      const parts = value.split(':');

      const badTag = [...parts];
      badTag[2] = 'ff'.repeat(16);
      expect(mod.decrypt(badTag.join(':'))).toBe('');

      const badCiphertext = [...parts];
      badCiphertext[3] = badCiphertext[3].replace(/^../, (h) =>
        h === '00' ? '11' : '00'
      );
      expect(mod.decrypt(badCiphertext.join(':'))).toBe('');
      expect(logMock.error).toHaveBeenCalledWith(
        '[Encryption] Decryption failed:',
        expect.any(Error)
      );
    });

    it('cannot read a v2 value when the keystore is unavailable', async () => {
      const key = keyFileOnDisk();
      const value = 'v2:' + gcmWith(key, 'secret');
      safeStorage.isEncryptionAvailable.mockReturnValue(false);
      const mod = await freshModule();

      expect(mod.decrypt(value)).toBe('');
      expect(mod.usesCurrentScheme(value)).toBe(false);
      expect(logMock.error).toHaveBeenCalledWith(
        '[Encryption] Decryption failed:',
        expect.objectContaining({
          message: expect.stringContaining('unavailable'),
        })
      );
      expect(logMock.warn).toHaveBeenCalledTimes(1);
      expect(logMock.warn).toHaveBeenCalledWith(
        expect.stringContaining('machine-bound key')
      );
    });

    it('falls back to the machine-bound key when the key file cannot be unwrapped, without replacing it', async () => {
      fsMock.readFileSync.mockImplementation((file: string) => {
        if (file.endsWith('.encryption-salt')) return SALT;
        if (file.endsWith('.encryption-key'))
          return Buffer.from('from-another-keystore').toString('base64');
        throw enoent();
      });
      const mod = await freshModule();

      const value = mod.encrypt('secret');
      expect(value.split(':')).toHaveLength(3);
      expect(mod.decrypt(value)).toBe('secret');
      expect(keyFileWrites()).toHaveLength(0);
      expect(logMock.error).toHaveBeenCalledWith(
        expect.stringContaining('Could not unwrap the data key'),
        expect.any(Error)
      );
    });

    it('falls back when the unwrapped key has the wrong length', async () => {
      keyFileOnDisk(crypto.randomBytes(16));
      const mod = await freshModule();

      expect(mod.encrypt('secret').split(':')).toHaveLength(3);
      expect(keyFileWrites()).toHaveLength(0);
      expect(logMock.error).toHaveBeenCalledWith(
        expect.stringContaining('Could not unwrap the data key'),
        expect.objectContaining({ message: expect.stringContaining('length') })
      );
    });

    it('falls back when the key file exists but cannot be read, without replacing it', async () => {
      fsMock.readFileSync.mockImplementation((file: string) => {
        if (file.endsWith('.encryption-salt')) return SALT;
        throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
      });
      const mod = await freshModule();

      expect(mod.encrypt('secret').split(':')).toHaveLength(3);
      expect(keyFileWrites()).toHaveLength(0);
      expect(safeStorage.encryptString).not.toHaveBeenCalled();
      expect(logMock.error).toHaveBeenCalledWith(
        expect.stringContaining('Could not read the wrapped data key'),
        expect.any(Error)
      );
    });

    it('falls back when the wrapped key cannot be persisted', async () => {
      fsMock.writeFileSync.mockImplementation((file: string) => {
        if (String(file).endsWith('.encryption-key'))
          throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
      });
      const mod = await freshModule();

      const value = mod.encrypt('secret');
      expect(value.split(':')).toHaveLength(3);
      expect(mod.decrypt(value)).toBe('secret');
      expect(logMock.error).toHaveBeenCalledWith(
        expect.stringContaining('Could not persist the wrapped data key'),
        expect.any(Error)
      );
    });

    it('resolves the keystore once per process', async () => {
      const mod = await freshModule();
      mod.encrypt('a');
      mod.encrypt('b');
      mod.decrypt(mod.encrypt('c'));
      expect(safeStorage.isEncryptionAvailable).toHaveBeenCalledTimes(1);
      expect(keyFileWrites()).toHaveLength(1);
    });

    it('treats a safeStorage that throws as unavailable', async () => {
      safeStorage.isEncryptionAvailable.mockImplementation(() => {
        throw new Error('safeStorage before ready');
      });
      const mod = await freshModule();

      expect(mod.encrypt('secret').split(':')).toHaveLength(3);
      expect(logMock.warn).toHaveBeenCalledTimes(1);
    });
  });
});
