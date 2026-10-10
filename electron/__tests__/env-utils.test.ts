import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('electron', () => ({ app: { isPackaged: false } }));

import {
  isMarketplaceEnabled,
  assertMarketplaceEnabled,
  MARKETPLACE_DISABLED_MESSAGE,
} from '../utils/env-utils';

describe('marketplace feature flag', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is disabled when MARKETPLACE_ENABLED is unset', () => {
    vi.stubEnv('MARKETPLACE_ENABLED', '');
    expect(isMarketplaceEnabled()).toBe(false);
    expect(() => assertMarketplaceEnabled()).toThrow(
      MARKETPLACE_DISABLED_MESSAGE
    );
  });

  it('only accepts the exact value "true"', () => {
    vi.stubEnv('MARKETPLACE_ENABLED', '1');
    expect(isMarketplaceEnabled()).toBe(false);
  });

  it('is enabled when MARKETPLACE_ENABLED=true', () => {
    vi.stubEnv('MARKETPLACE_ENABLED', 'true');
    expect(isMarketplaceEnabled()).toBe(true);
    expect(() => assertMarketplaceEnabled()).not.toThrow();
  });
});
