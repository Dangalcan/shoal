/**
 * Encryption Utilities
 *
 * Provides basic encryption for sensitive plugin data (license keys, etc.).
 * In a real-world app, we would use more robust system-keychain integration.
 */

import crypto from 'crypto';
import { machineIdSync } from 'node-machine-id';

// Use machine ID as a base for the encryption key to make it device-specific
const ENCRYPTION_KEY = crypto.scryptSync(
  machineIdSync(),
  'salt-kd-plugins',
  32
);
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('[Encryption] Decryption failed:', error);
    return '';
  }
}
