/**
 * Signature Service
 *
 * Verifies plugin signatures (RSA-SHA256). A signature covers every file in
 * the plugin directory, code included, through the file list described in
 * plugin-integrity.ts.
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
import { getErrorMessage } from '../../utils/error-utils';
import {
  SIGNATURE_FILE,
  canonicalPayload,
  compareFiles,
  hashPluginFiles,
  parseSignatureFile,
} from './plugin-integrity';

export class SignatureService {
  // RSA-2048 public key — generated 2026-10-10 (rotated; the 2026-03-10 key's
  // private half was lost). Replace both this key AND the private key in your
  // secrets manager if you need to rotate. After rotation, all plugins must be
  // re-signed. kdMarket signs with the same key pair.
  private readonly PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyrPH0qaxd66sPXUtKC8U
EH35T5TXkRffe8VxTTyCqNKloQcAzOTF5ELbSfsloCcD77iNG7JetpLtRaBm+qa2
vIaeCVVRrIbyqJVq9rLLxb7SiF1i1RJQ/sYBwaYFyZPjD041RxR3JM9WMaWt8A2N
aYOH3TWOxuItDpamx6ZIC+UJw8Wl2M1Ss0OTMajjdgUKacOMwzCcZUn0liYVKUNW
nA49YMyymkdshW+kPmfC2Y5a7QMvCGppZX5R84/JoAftVviowdlhv1G7RheckPx2
mTG4NWftfh6O1ZzUYCIoRqSP04p+X/t1PXuFh0IM7YCvOmzLq60UIX2ALjzymiRz
9wIDAQAB
-----END PUBLIC KEY-----`;

  /**
   * Verify a plugin directory against its `plugin.json.sig` (format 2): the
   * signature over the file list must be valid and the directory must hold
   * exactly the signed files with the signed contents.
   *
   * Development builds with ALLOW_UNSIGNED_PLUGINS=true still load a plugin
   * whose signature is missing or out of date (edited sources), with a
   * warning. Packaged builds ignore that flag.
   */
  async verifyPlugin(pluginPath: string): Promise<boolean> {
    const problem = await this.findProblem(pluginPath);
    if (!problem) return true;

    if (process.env.ALLOW_UNSIGNED_PLUGINS === 'true') {
      if (app?.isPackaged) {
        log.error(
          `[SignatureService] ALLOW_UNSIGNED_PLUGINS=true is ignored in packaged builds. ` +
            `Plugin at "${pluginPath}" will not load: ${problem}.`
        );
        return false;
      }
      log.warn(
        `[SignatureService] Plugin at "${pluginPath}": ${problem}. ` +
          'Loading anyway because ALLOW_UNSIGNED_PLUGINS=true (development only).'
      );
      return true;
    }

    log.error(
      `[SignatureService] Plugin at "${pluginPath}" failed verification: ${problem}. ` +
        'Sign it with: node scripts/sign-plugin.js <plugin-directory>'
    );
    return false;
  }

  /** Why the plugin does not verify, or null when it does. */
  private async findProblem(pluginPath: string): Promise<string | null> {
    let content: string;
    try {
      content = await fs.readFile(
        path.join(pluginPath, SIGNATURE_FILE),
        'utf-8'
      );
    } catch {
      return 'no signature file';
    }

    try {
      const signed = parseSignatureFile(content);
      if (
        !this.verifySignature(canonicalPayload(signed.files), signed.signature)
      ) {
        return 'invalid signature';
      }
      const differences = compareFiles(
        signed.files,
        await hashPluginFiles(pluginPath)
      );
      if (differences.length > 0) {
        return `files do not match the signature (${differences.slice(0, 5).join(', ')})`;
      }
      return null;
    } catch (error) {
      return getErrorMessage(error);
    }
  }

  /**
   * The public key used to verify plugin signatures. Defaults to the embedded
   * key, but a marketplace deployment can override it via MARKETPLACE_PUBLIC_KEY
   * (PEM, with literal "\n" for line breaks) so the app trusts plugins signed by
   * that marketplace — fetch it from the backend's /v1/signing-public-key. This
   * makes key rotation a config change, not a code change.
   */
  private get verificationKey(): string {
    const override = process.env.MARKETPLACE_PUBLIC_KEY;
    if (override && override.includes('BEGIN PUBLIC KEY')) {
      return override.replace(/\\n/g, '\n');
    }
    return this.PUBLIC_KEY;
  }

  /**
   * Verify a hex-encoded RSA-SHA256 signature against the verification key.
   */
  private verifySignature(data: string, signature: string): boolean {
    try {
      return crypto.verify(
        'sha256',
        Buffer.from(data),
        this.verificationKey,
        Buffer.from(signature.trim(), 'hex')
      );
    } catch (error) {
      log.error('[SignatureService] Signature check failed:', error);
      return false;
    }
  }
}

export const signatureService = new SignatureService();
