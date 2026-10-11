import { describe, it, expect } from 'vitest';
import { providerFromContext } from '../../../features/clusters/provider';

describe('providerFromContext', () => {
  it('recognises kind and k3d contexts by prefix', () => {
    expect(providerFromContext('kind-dev')).toBe('kind');
    expect(providerFromContext('kind')).toBe('kind');
    expect(providerFromContext('k3d-staging')).toBe('k3d');
    expect(providerFromContext('k3d')).toBe('k3d');
  });

  it('returns null for any other context', () => {
    expect(providerFromContext('docker-desktop')).toBeNull();
    expect(providerFromContext('prod-eks')).toBeNull();
    expect(providerFromContext('kindness')).toBeNull();
  });
});
