/**
 * Plugin integrity
 *
 * A plugin signature (format 2) covers every file in the plugin directory, not
 * only plugin.json: `plugin.json.sig` lists the SHA-256 of each file and an
 * RSA-SHA256 signature over that list. Verification checks the signature and
 * then that the directory holds exactly those files with those hashes, so
 * swapping index.js or renderer.js under a signed manifest is caught.
 *
 * scripts/sign-plugin.js builds the same list; keep both in sync (a test signs
 * with the script and verifies with SignatureService).
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export const SIGNATURE_FILE = 'plugin.json.sig';
export const SIGNATURE_FORMAT = 'shoal-plugin-signature/2';

/** Contents of `plugin.json.sig`. */
export interface PluginSignature {
  format: string;
  /** Relative POSIX path -> lowercase hex SHA-256 of the file bytes. */
  files: Record<string, string>;
  /** Hex RSA-SHA256 signature over `canonicalPayload(files)`. */
  signature: string;
}

/**
 * Hashes every regular file under `pluginDir` except the signature file.
 * Symbolic links are refused: they could point outside the plugin.
 */
export async function hashPluginFiles(
  pluginDir: string
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(pluginDir, full).split(path.sep).join('/');
      if (entry.isSymbolicLink()) {
        throw new Error(`Symbolic links are not allowed in plugins: ${rel}`);
      }
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && rel !== SIGNATURE_FILE) {
        const bytes = await fs.readFile(full);
        files[rel] = crypto.createHash('sha256').update(bytes).digest('hex');
      }
    }
  }

  await walk(pluginDir);
  return files;
}

/** The exact bytes that get signed: a header line, then one line per file. */
export function canonicalPayload(files: Record<string, string>): string {
  const lines = Object.keys(files)
    .sort()
    .map((rel) => `${files[rel]}  ${rel}\n`);
  return `${SIGNATURE_FORMAT}\n${lines.join('')}`;
}

/**
 * A relative POSIX path a signature may list: no control characters (a line
 * break would let two file lists sign the same bytes), no backslashes, no
 * absolute paths and no `.`/`..` segments.
 */
export function isSafeRelativePath(rel: string): boolean {
  if (typeof rel !== 'string' || rel === '') return false;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f\\]/.test(rel)) return false;
  if (rel.startsWith('/')) return false;
  return rel
    .split('/')
    .every((part) => part !== '' && part !== '.' && part !== '..');
}

const hasOwn = (object: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(object, key);

/** Parses `plugin.json.sig`; throws with a readable reason when malformed. */
export function parseSignatureFile(content: string): PluginSignature {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error(
      'plugin.json.sig is not a format 2 signature (re-sign the plugin)'
    );
  }
  const sig = data as Partial<PluginSignature>;
  if (sig.format !== SIGNATURE_FORMAT) {
    throw new Error(`Unsupported signature format: ${String(sig.format)}`);
  }
  if (
    !sig.files ||
    typeof sig.files !== 'object' ||
    typeof sig.signature !== 'string'
  ) {
    throw new Error('plugin.json.sig is missing its file list or signature');
  }
  for (const rel of Object.keys(sig.files)) {
    if (!isSafeRelativePath(rel) || typeof sig.files[rel] !== 'string') {
      throw new Error(
        `plugin.json.sig lists an invalid file name: ${JSON.stringify(rel)}`
      );
    }
  }
  return sig as PluginSignature;
}

/** Differences between the signed file list and the directory on disk. */
export function compareFiles(
  signed: Record<string, string>,
  actual: Record<string, string>
): string[] {
  const problems: string[] = [];
  for (const rel of Object.keys(signed).sort()) {
    if (!hasOwn(actual, rel)) problems.push(`missing ${rel}`);
    else if (actual[rel] !== signed[rel]) problems.push(`modified ${rel}`);
  }
  for (const rel of Object.keys(actual).sort()) {
    if (!hasOwn(signed, rel)) problems.push(`unexpected ${rel}`);
  }
  return problems;
}
