/**
 * Verifies the committed signatures of the bundled example plugins against the
 * public key embedded in SignatureService, with real crypto and real files.
 *
 * This pins the embedded key (a rotation without re-signing fails here) and
 * catches any change to a signed plugin file (manifest or code), including
 * line-ending drift.
 */
import { describe, it, expect } from 'vitest';
import path from 'path';
import { SignatureService } from '../services/security/signature-service';
import { BUNDLED_DEFAULT_ENABLED } from '../constants';

const PLUGINS_DIR = path.resolve(__dirname, '..', '..', 'plugins');

describe('bundled plugin signatures', () => {
  const service = new SignatureService();

  it.each(BUNDLED_DEFAULT_ENABLED)(
    '%s files match their committed signature',
    async (pluginId) => {
      const verified = await service.verifyPlugin(
        path.join(PLUGINS_DIR, pluginId)
      );
      expect(verified).toBe(true);
    }
  );
});
