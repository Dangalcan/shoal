import { describe, it, expect } from 'vitest';
import {
  getOwnershipState,
  formatExpiry,
} from '../../../features/marketplace/ownership';
import type { Plugin } from '../../../../electron/types/plugin-types';

function makePlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    manifest: { id: 'p1' },
    state: 'enabled',
    installedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Plugin;
}

describe('getOwnershipState', () => {
  it('returns none when the plugin is not installed', () => {
    expect(getOwnershipState(undefined, true)).toBe('none');
    expect(getOwnershipState(undefined, false)).toBe('none');
  });

  it('returns expired when the plugin state is expired', () => {
    const p = makePlugin({
      state: 'expired',
      licenseInfo: { isActive: false },
    });
    expect(getOwnershipState(p, true)).toBe('expired');
  });

  it('returns trial for trial state or an active trial license', () => {
    expect(getOwnershipState(makePlugin({ state: 'trial' }), true)).toBe(
      'trial'
    );
    expect(
      getOwnershipState(
        makePlugin({ licenseInfo: { isActive: false, isTrialActive: true } }),
        true
      )
    ).toBe('trial');
  });

  it('returns licensed for a paid plugin with an active license', () => {
    const p = makePlugin({ licenseInfo: { isActive: true } });
    expect(getOwnershipState(p, true)).toBe('licensed');
  });

  it('returns installed for free plugins even with an active license record', () => {
    const p = makePlugin({ licenseInfo: { isActive: true } });
    expect(getOwnershipState(p, false)).toBe('installed');
  });

  it('returns installed for a paid plugin without license info', () => {
    expect(getOwnershipState(makePlugin(), true)).toBe('installed');
  });
});

describe('formatExpiry', () => {
  it('formats a valid ISO date', () => {
    expect(formatExpiry('2026-12-31T00:00:00Z')).toBeTruthy();
  });

  it('returns undefined for missing or invalid input', () => {
    expect(formatExpiry(undefined)).toBeUndefined();
    expect(formatExpiry('not-a-date')).toBeUndefined();
  });
});
