import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import log from '../logger';

/** Silently removes a temporary file, logging a warning on failure. */
/**
 * Throws when a file named by a plugin manifest (`main`, `data`, ...) resolves
 * outside the plugin's own directory.
 */
export function assertInsidePlugin(
  pluginDir: string,
  file: string,
  what: string
): void {
  if (!isPathInside(pluginDir, path.resolve(file))) {
    throw new Error(`Plugin ${what} escapes the plugin directory: ${file}`);
  }
}

export async function cleanupTempFile(
  filePath: string,
  label = 'temp file'
): Promise<void> {
  await fs
    .unlink(filePath)
    .catch((e: unknown) =>
      log.warn(`Failed to clean up ${label} "${filePath}":`, e)
    );
}

/**
 * Returns true if `child` is `parent` itself or lives inside it, using
 * resolved absolute paths. Guards against `..` traversal and absolute
 * entry paths.
 */
export function isPathInside(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Extract a zip archive into `destDir`, rejecting any entry whose resolved
 * path would escape `destDir` (zip-slip / path traversal). AdmZip's own
 * `extractAllTo` does not perform this check, so we extract entry-by-entry.
 *
 * @throws if any entry escapes destDir; nothing is left partially extracted
 *         beyond destDir itself.
 */
export async function extractZipSafe(
  zipPath: string,
  destDir: string
): Promise<void> {
  const resolvedDest = path.resolve(destDir);
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  // First pass: validate every entry before writing anything.
  for (const entry of entries) {
    const targetPath = path.resolve(resolvedDest, entry.entryName);
    if (!isPathInside(resolvedDest, targetPath)) {
      throw new Error(
        `[extractZipSafe] Blocked zip-slip entry: "${entry.entryName}"`
      );
    }
  }

  // Second pass: write files and directories.
  for (const entry of entries) {
    const targetPath = path.resolve(resolvedDest, entry.entryName);
    if (entry.isDirectory) {
      await fs.mkdir(targetPath, { recursive: true });
    } else {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, entry.getData());
    }
  }
}

/** Compute the lowercase hex SHA-256 digest of a file. */
export async function sha256File(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }
  return hash.digest('hex');
}

/**
 * Verify a file's SHA-256 against an expected hex digest, using a
 * length-safe constant-time comparison. Accepts an optional "sha256:" prefix.
 *
 * @throws if the digest does not match.
 */
export async function verifyFileChecksum(
  filePath: string,
  expectedHex: string
): Promise<void> {
  const expected = expectedHex
    .trim()
    .replace(/^sha256:/i, '')
    .toLowerCase();
  const actual = await sha256File(filePath);
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error(`Checksum mismatch: expected ${expected}, got ${actual}`);
  }
}
