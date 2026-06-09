/**
 * Encryption Utilities
 *
 * Provides AES-256-GCM encryption for sensitive plugin data (license keys, etc.)
 * bound to this specific machine.
 *
 * Key derivation:
 *  - Base secret : machine ID (hardware-bound, via node-machine-id)
 *  - Salt        : a 32-byte random value generated on first run and stored in
 *                  <userData>/.encryption-salt  (never committed to source control)
 *
 * Encrypted format (GCM): "<ivHex>:<authTagHex>:<ciphertextHex>"
 * Legacy format   (CBC):  "<ivHex>:<ciphertextHex>"   (two-part — decrypted on read, re-encrypted as GCM on next write)
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { machineIdSync } from 'node-machine-id';
import log from '../../logger';

const GCM_IV_LENGTH = 12;
const CBC_IV_LENGTH = 16;

// ---------------------------------------------------------------------------
// Lazy key initialisation — deferred until first use so that `app` is ready.
// ---------------------------------------------------------------------------

let _encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (_encryptionKey) return _encryptionKey;

  const salt = getOrCreateSalt();
  _encryptionKey = crypto.scryptSync(machineIdSync(), salt, 32);
  return _encryptionKey;
}

/**
 * Read the persisted salt from disk, or create and save a new random one.
 * The salt file is stored in the Electron userData directory (not in the app bundle).
 */
function getOrCreateSalt(): string {
  const saltPath = path.join(app.getPath('userData'), '.encryption-salt');

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
// Public API
// ---------------------------------------------------------------------------

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  return (
    iv.toString('hex') +
    ':' +
    authTag.toString('hex') +
    ':' +
    encrypted.toString('hex')
  );
}

export function decrypt(text: string): string {
  try {
    const key = getEncryptionKey();
    const parts = text.split(':');

    if (parts.length === 3) {
      // GCM format: iv:authTag:ciphertext
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const ciphertext = Buffer.from(parts[2], 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    }

    if (parts.length === 2) {
      // Legacy CBC format: iv:ciphertext — decrypt and allow caller to re-encrypt as GCM on next write
      const iv = Buffer.from(parts[0], 'hex');
      if (iv.length !== CBC_IV_LENGTH) throw new Error('Invalid CBC IV length');
      const ciphertext = Buffer.from(parts[1], 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      log.info(
        '[Encryption] Decrypted legacy CBC value — will be re-encrypted as GCM on next save'
      );
      return decrypted.toString();
    }

    throw new Error('Unrecognised encrypted format');
  } catch (error) {
    log.error('[Encryption] Decryption failed:', error);
    return '';
  }
}

/** Returns true if the value is in the legacy CBC format and should be re-encrypted. */
export function isLegacyCBC(text: string): boolean {
  return text.split(':').length === 2;
}

// Keep old IV_LENGTH export for any tests that reference it directly
export const IV_LENGTH = GCM_IV_LENGTH;
