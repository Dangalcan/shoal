import fs from 'fs/promises';
import log from '../logger';

/** Silently removes a temporary file, logging a warning on failure. */
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
