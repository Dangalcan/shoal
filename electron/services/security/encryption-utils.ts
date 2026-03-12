/**
 * Encryption Utilities
 *
 * Provides AES-256-CBC encryption for sensitive plugin data (license keys, etc.)
 * bound to this specific machine.
 *
 * Key derivation:
 *  - Base secret : machine ID (hardware-bound, via node-machine-id)
 *  - Salt        : a 32-byte random value generated on first run and stored in
 *                  <userData>/.encryption-salt  (never committed to source control)
 *
 * This replaces the previous approach of falling back to a hardcoded salt string,
 * which made the encryption trivially reversible on any machine that had the source.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { machineIdSync } from 'node-machine-id';

const IV_LENGTH = 16;

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
    console.error('[Encryption] Could not persist encryption salt:', err);
  }

  return newSalt;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  try {
    const key = getEncryptionKey();
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('[Encryption] Decryption failed:', error);
    return '';
  }
}
