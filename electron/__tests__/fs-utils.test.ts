import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import log from '../logger';
import { cleanupTempFile } from '../utils/fs-utils';

vi.mock('fs/promises', () => {
  const unlink = vi.fn();
  return {
    unlink,
    default: {
      unlink,
    },
  };
});
vi.mock('../logger');

describe('fs-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cleanupTempFile', () => {
    it('should successfully delete a file', async () => {
      (fs.unlink as any).mockResolvedValue(undefined);

      await cleanupTempFile('/test/path', 'test-file');

      expect(fs.unlink).toHaveBeenCalledWith('/test/path');
      expect(log.warn).not.toHaveBeenCalled();
    });

    it('should log a warning if file deletion fails', async () => {
      const error = new Error('Permission denied');
      (fs.unlink as any).mockRejectedValue(error);

      await cleanupTempFile('/test/path', 'test-file');

      expect(fs.unlink).toHaveBeenCalledWith('/test/path');
      expect(log.warn).toHaveBeenCalledWith(
        'Failed to clean up test-file "/test/path":',
        error
      );
    });

    it('should use default label if not provided', async () => {
      const error = new Error('File not found');
      (fs.unlink as any).mockRejectedValue(error);

      await cleanupTempFile('/test/path');

      expect(log.warn).toHaveBeenCalledWith(
        'Failed to clean up temp file "/test/path":',
        error
      );
    });
  });
});
