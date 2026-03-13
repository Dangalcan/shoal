/**
 * Signature Service
 *
 * Handles signing and verification of plugin manifests using RSA-SHA256.
 *
 * Key management:
 *  - The public key is embedded in this file (safe to commit).
 *  - The matching private key is used only by the signing script
 *    (scripts/sign-plugin.js) and must never be committed.
 *
 * To sign a plugin:
 *   node scripts/sign-plugin.js <plugin-directory>
 *
 * To allow loading unsigned plugins during local development, set:
 *   ALLOW_UNSIGNED_PLUGINS=true
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import log from '../../logger';

export class SignatureService {
  // RSA-2048 public key — generated 2026-03-10.
  // Replace both this key AND the private key in your secrets manager if you
  // need to rotate. After rotation, all plugins must be re-signed.
  private readonly PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmCJdMe7FyOkBUF/6Vd76
z0h5lXidoSEBGAMCUpx+Ths5ZJl5aXniwiDRPB8S6qhS+jR4hAVMOmCG6CY/riit
Qx0GcNu03xObqMjQjNdIuAwhOLaliyMq4aCISvNptMwXzauFxc4aLmUHT5i9iNTs
lqGJvUSXKXqTQAQBPsAqdATCWZQfjT/i3wURmghITuZ1IKwEdgy5PczAPoKSa04z
aSXYMYpjU88CAH8KUUb4Dv5K641pgaGD0xBWSCh+Cw8PkkWwGyQh84ChAJnE5i/B
vPm0Dr5z8tb65FQXZZDcqLo1ZeVO9SP3fiNTs4S1C+VpLu/JJ1Mnr5uDCrhCI+D+
swIDAQAB
-----END PUBLIC KEY-----`;

  /**
   * Verify a plugin's manifest signature.
   *
   * Returns true only when:
   *  - A valid signature file exists and matches the manifest, OR
   *  - ALLOW_UNSIGNED_PLUGINS=true is set (development only).
   *
   * Returns false (plugin will not load) when the signature is missing or invalid.
   */
  async verifyPlugin(pluginPath: string): Promise<boolean> {
    try {
      const manifestPath = path.join(pluginPath, 'plugin.json');
      const signaturePath = path.join(pluginPath, 'plugin.json.sig');

      const manifestContent = await fs.readFile(manifestPath, 'utf-8');

      try {
        const signature = await fs.readFile(signaturePath, 'utf-8');
        return this.verifySignature(manifestContent, signature);
      } catch {
        // Signature file is missing.
        if (process.env.ALLOW_UNSIGNED_PLUGINS === 'true') {
          if (app?.isPackaged) {
            log.error(
              `[SignatureService] ALLOW_UNSIGNED_PLUGINS=true is ignored in packaged builds. ` +
                `Plugin at "${pluginPath}" will not load.`
            );
            return false;
          }
          log.warn(
            `[SignatureService] Plugin at "${pluginPath}" is unsigned. ` +
              'Loading anyway because ALLOW_UNSIGNED_PLUGINS=true (development only).'
          );
          return true;
        }
        log.error(
          `[SignatureService] Plugin at "${pluginPath}" has no signature file. ` +
            'Sign it with: node scripts/sign-plugin.js <plugin-directory>'
        );
        return false;
      }
    } catch (error) {
      log.error('[SignatureService] Verification failed:', error);
      return false;
    }
  }

  /**
   * Verify a hex-encoded RSA-SHA256 signature against the embedded public key.
   */
  private verifySignature(data: string, signature: string): boolean {
    try {
      return crypto.verify(
        'sha256',
        Buffer.from(data),
        this.PUBLIC_KEY,
        Buffer.from(signature.trim(), 'hex')
      );
    } catch (error) {
      log.error('[SignatureService] Signature check failed:', error);
      return false;
    }
  }
}

export const signatureService = new SignatureService();
