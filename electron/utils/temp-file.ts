/**
 * Temporary files handed to kubectl.
 *
 * The shared temp directory is readable by every user on Linux, and a
 * predictable name could be created (or linked) there in advance. Files get
 * an unguessable name, owner-only permissions and exclusive creation.
 */

import { randomBytes } from 'crypto';
import path from 'path';
import { app } from 'electron';

/** `fs.writeFile` options: owner-only, never over an existing file. */
export const PRIVATE_FILE_WRITE = {
  encoding: 'utf-8',
  mode: 0o600,
  flag: 'wx',
} as const;

/** An unguessable path in the app's temp directory. */
export function privateTempPath(prefix: string, extension: string): string {
  const token = randomBytes(12).toString('hex');
  return path.join(app.getPath('temp'), `${prefix}-${token}${extension}`);
}
