/**
 * Encryption Utilities
 *
 * AES-256-GCM encryption for the plugin secrets kept in plugin-config.json
 * (license keys and the manifest settings flagged `secret: true`).
 *
 * Two key schemes, resolved on first use (which must happen after `app` is
 * ready, because `safeStorage` is):
 *
 *  - Keystore (current). A random 32-byte data key, generated once per
 *    profile and stored wrapped by Electron `safeStorage` (DPAPI on Windows,
 *    Keychain on macOS, libsecret or KWallet on Linux) in
 *    <userData>/.encryption-key, owner-only. The raw key never reaches the
 *    disk. Values read "v2:<ivHex>:<authTagHex>:<ciphertextHex>".
 *
 *  - Machine-bound (fallback, and the only scheme of earlier builds).
 *    scrypt(machine id, salt) with the salt in <userData>/.encryption-salt,
 *    next to the data, so it only stops copying the files to another machine.
 *    Used when `safeStorage` reports no keystore (Linux without a keyring,
 *    unit tests) and to read values written before the keystore scheme.
 *    GCM values read "<ivHex>:<authTagHex>:<ciphertextHex>"; the CBC values
 *    of the first builds read "<ivHex>:<ciphertextHex>".
 *
 * `encrypt` writes with the best scheme available and `decrypt` reads all of
 * them, so a caller migrates a stored value by re-encrypting it when
 * `usesCurrentScheme` says it was written with an older one.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app, safeStorage } from 'electron';
import { machineIdSync } from 'node-machine-id';
import log from '../../logger';

const GCM_IV_LENGTH = 12;
const CBC_IV_LENGTH = 16;
const DATA_KEY_LENGTH = 32;
const KEYSTORE_FORMAT = 'v2';
const SALT_FILE = '.encryption-salt';
const DATA_KEY_FILE = '.encryption-key';

// ---------------------------------------------------------------------------
// Machine-bound key (fallback): scrypt(machine id, persisted salt)
// ---------------------------------------------------------------------------

let _machineKey: Buffer | null = null;

function getMachineKey(): Buffer {
  if (_machineKey) return _machineKey;

  const salt = getOrCreateSalt();
  _machineKey = crypto.scryptSync(machineIdSync(), salt, 32);
  return _machineKey;
}

/**
 * Read the persisted salt from disk, or create and save a new random one.
 * The salt file is stored in the Electron userData directory (not in the app bundle).
 */
function getOrCreateSalt(): string {
  const saltPath = path.join(app.getPath('userData'), SALT_FILE);

  try {
    const existing = fs.readFileSync(saltPath, 'utf-8').trim();
    if (existing.length >= 32) return existing;
  } catch {
    // File does not exist yet — create it below.
  }

  const newSalt = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(path.dirname(saltPath), { recursive: true });
    fs.writeFileSync(saltPath, newSalt, { mode: 0o600 });
  } catch (err) {
    // Non-fatal: encryption will still work this session, but the key will
    // differ on the next run (persisted data will be unreadable).
    log.error('[Encryption] Could not persist encryption salt:', err);
  }

  return newSalt;
}

// ---------------------------------------------------------------------------
// Keystore-wrapped data key (current scheme)
// ---------------------------------------------------------------------------

/** `undefined` until resolved; `null` when the keystore is unavailable. */
let _dataKey: Buffer | null | undefined;

function keystoreAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable() === true;
  } catch {
    // Outside Electron (tests) the module has no safeStorage.
    return false;
  }
}

function getDataKey(): Buffer | null {
  if (_dataKey === undefined) _dataKey = loadOrCreateDataKey();
  return _dataKey;
}

/**
 * Unwrap the data key from <userData>/.encryption-key, or create and wrap a
 * new one. Every failure falls back to the machine-bound key for this
 * session; an existing key file is never replaced, because the values
 * written with its key would be lost.
 */
function loadOrCreateDataKey(): Buffer | null {
  if (!keystoreAvailable()) {
    log.warn(
      '[Encryption] No OS keystore (safeStorage unavailable): plugin secrets use the machine-bound key'
    );
    return null;
  }

  const keyPath = path.join(app.getPath('userData'), DATA_KEY_FILE);

  let wrapped: string | null = null;
  try {
    wrapped = fs.readFileSync(keyPath, 'utf-8').trim();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.error(
        '[Encryption] Could not read the wrapped data key; using the machine-bound key this session:',
        err
      );
      return null;
    }
  }

  if (wrapped !== null) {
    try {
      const key = Buffer.from(
        safeStorage.decryptString(Buffer.from(wrapped, 'base64')),
        'base64'
      );
      if (key.length !== DATA_KEY_LENGTH) {
        throw new Error(`Unexpected data key length ${key.length}`);
      }
      return key;
    } catch (err) {
      log.error(
        '[Encryption] Could not unwrap the data key; using the machine-bound key this session:',
        err
      );
      return null;
    }
  }

  const key = crypto.randomBytes(DATA_KEY_LENGTH);
  try {
    const wrappedKey = safeStorage
      .encryptString(key.toString('base64'))
      .toString('base64');
    fs.mkdirSync(path.dirname(keyPath), { recursive: true });
    fs.writeFileSync(keyPath, wrappedKey, { mode: 0o600 });
  } catch (err) {
    log.error(
      '[Encryption] Could not persist the wrapped data key; using the machine-bound key:',
      err
    );
    return null;
  }

  log.info('[Encryption] Created the keystore-wrapped data key');
  return key;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function encrypt(text: string): string {
  const dataKey = getDataKey();
  const key = dataKey ?? getMachineKey();
  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  const body = [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString('hex'))
    .join(':');
  return dataKey ? `${KEYSTORE_FORMAT}:${body}` : body;
}

function decryptGcm(
  key: Buffer,
  ivHex: string,
  authTagHex: string,
  ciphertextHex: string
): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]).toString();
}

/** Decrypts a value of any scheme; returns '' (and logs) when it cannot. */
export function decrypt(text: string): string {
  try {
    const parts = text.split(':');

    if (parts.length === 4 && parts[0] === KEYSTORE_FORMAT) {
      const key = getDataKey();
      if (!key) {
        throw new Error(
          'Value was encrypted with the keystore-wrapped key, which is unavailable'
        );
      }
      return decryptGcm(key, parts[1], parts[2], parts[3]);
    }

    if (parts.length === 3) {
      // Machine-bound GCM: iv:authTag:ciphertext
      return decryptGcm(getMachineKey(), parts[0], parts[1], parts[2]);
    }

    if (parts.length === 2) {
      // Legacy CBC format: iv:ciphertext — decrypt and allow caller to re-encrypt on next write
      const iv = Buffer.from(parts[0], 'hex');
      if (iv.length !== CBC_IV_LENGTH) throw new Error('Invalid CBC IV length');
      const ciphertext = Buffer.from(parts[1], 'hex');
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        getMachineKey(),
        iv
      );
      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      log.info(
        '[Encryption] Decrypted legacy CBC value — will be re-encrypted on next save'
      );
      return decrypted.toString();
    }

    throw new Error('Unrecognised encrypted format');
  } catch (error) {
    log.error('[Encryption] Decryption failed:', error);
    return '';
  }
}

/**
 * True when the value was written with the scheme `encrypt` uses now. False
 * means it still decrypts (if at all) but should be re-encrypted on the next
 * save: a machine-bound value once the keystore is available, a CBC value,
 * or a keystore value while the keystore is unavailable.
 */
export function usesCurrentScheme(text: string): boolean {
  const parts = text.split(':');
  const keystoreValue = parts.length === 4 && parts[0] === KEYSTORE_FORMAT;
  return getDataKey() ? keystoreValue : parts.length === 3;
}

/** Returns true if the value is in the legacy CBC format and should be re-encrypted. */
export function isLegacyCBC(text: string): boolean {
  return text.split(':').length === 2;
}
