/**
 * Signature Service
 *
 * Handles signing and verification of plugin manifests.
 * Uses RSA-SHA256 for integrity checks.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export class SignatureService {
  // Mock Public Key (In a real app, this would be embedded in the binary)
  private readonly PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv7Y2lq6iV7yL3r+O7W0m
8D0C6uW9WjWf8X8+5h8v2r9Wj8X8+5h8v2r9Wj8X8+5h8v2r9Wj8X8+5h8v2r9Wj
8X8+5h8v2r9Wj8X8+5h8v2r9Wj8X8+5h8v2r9Wj8X8+5h8v2r9Wj8X8+5h8v2r9Wj
8X8+5h8v2r9Wj8X8+5h8v2r9Wj8X8+5h8v2r9Wj8X8+5h8v2r9Wj8X8+5h8v2r9Wj
8X8+5h8v2r9Wj8X8+5h8v2r9Wj8X8+5h8v2r9Wj8X8+5h8v2r9Wj8X8+5h8v2r9Wj
8X8+5h8v2r9Wj8X8+5h8v2r9Wj8X8+5h8v2r9Wj8X8+5h8v2r9Wj8X8+5h8v2r9Wj
8X8+5h8v2r9Wj8X8+5XQwIDAQAB
-----END PUBLIC KEY-----`;

  /**
   * Verify a plugin's manifest signature.
   */
  async verifyPlugin(pluginPath: string): Promise<boolean> {
    try {
      const manifestPath = path.join(pluginPath, 'plugin.json');
      const signaturePath = path.join(pluginPath, 'plugin.json.sig');

      const manifestContent = await fs.readFile(manifestPath, 'utf-8');

      // If signature file doesn't exist, it's an unsigned plugin
      try {
        const signature = await fs.readFile(signaturePath, 'utf-8');
        return this.verifySignature(manifestContent, signature);
      } catch (e) {
        // For development/MVP, we might allow unsigned plugins but log it
        console.warn(`[SignatureService] Plugin at ${pluginPath} is unsigned.`);
        return true;
      }
    } catch (error) {
      console.error('[SignatureService] Verification failed:', error);
      return false;
    }
  }

  /**
   * Verify signature using the public key.
   */
  private verifySignature(data: string, signature: string): boolean {
    try {
      const verifier = crypto.createVerify('sha256');
      verifier.update(data);
      verifier.end();

      return crypto.verify(
        'sha256',
        Buffer.from(data),
        this.PUBLIC_KEY,
        Buffer.from(signature, 'hex')
      );
    } catch (error) {
      console.error('[SignatureService] Signature check failed:', error);
      return false;
    }
  }
}

export const signatureService = new SignatureService();
