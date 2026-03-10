import { describe, it, expect } from 'vitest';
import {
  sortByString,
  sortByNumber,
  sortByDate,
  reverseSorter,
} from '../../../lib/sorting/sortStrategies';
import type { K8sResource } from '../../../types/k8s-types';

const makeResource = (overrides: any = {}): K8sResource =>
  ({
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { name: 'test', uid: '1', resourceVersion: '1' },
    ...overrides,
  }) as unknown as K8sResource;

describe('sortStrategies', () => {
  describe('sortByString', () => {
    it('should sort ascending by extracted string', () => {
      const sorter = sortByString((r) => (r as any).metadata.name);
      const a = makeResource({
        metadata: { name: 'apple', uid: '1', resourceVersion: '1' },
      });
      const b = makeResource({
        metadata: { name: 'banana', uid: '2', resourceVersion: '1' },
      });

      expect(sorter(a, b)).toBeLessThan(0);
      expect(sorter(b, a)).toBeGreaterThan(0);
      expect(sorter(a, a)).toBe(0);
    });

    it('should treat undefined/null getter result as empty string', () => {
      const sorter = sortByString((r) => (r as any).nonexistent || '');
      const a = makeResource();
      const b = makeResource();
      expect(sorter(a, b)).toBe(0);
    });

    it('should return 0 for equal strings', () => {
      const sorter = sortByString((r) => 'same');
      const a = makeResource();
      const b = makeResource();
      expect(sorter(a, b)).toBe(0);
    });
  });

  describe('sortByNumber', () => {
    it('should sort ascending by extracted number', () => {
      const sorter = sortByNumber((r) => (r as any).count);
      const low = makeResource({ count: 2 });
      const high = makeResource({ count: 10 });

      expect(sorter(low, high)).toBeLessThan(0);
      expect(sorter(high, low)).toBeGreaterThan(0);
      expect(sorter(low, low)).toBe(0);
    });

    it('should treat falsy values (undefined/0/null) as 0', () => {
      const sorter = sortByNumber((r) => (r as any).count || 0);
      const a = makeResource({ count: undefined });
      const b = makeResource({ count: 0 });
      expect(sorter(a, b)).toBe(0);
    });
  });

  describe('sortByDate', () => {
    it('should sort by ISO date string ascending', () => {
      const sorter = sortByDate((r) => (r as any).metadata.creationTimestamp);
      const old = makeResource({
        metadata: {
          name: 'old',
          uid: '1',
          resourceVersion: '1',
          creationTimestamp: '2023-01-01T00:00:00Z',
        },
      });
      const young = makeResource({
        metadata: {
          name: 'young',
          uid: '2',
          resourceVersion: '1',
          creationTimestamp: '2024-06-01T00:00:00Z',
        },
      });

      expect(sorter(old, young)).toBeLessThan(0);
      expect(sorter(young, old)).toBeGreaterThan(0);
      expect(sorter(old, old)).toBe(0);
    });

    it('should treat missing timestamps as epoch (0)', () => {
      const sorter = sortByDate((r) => (r as any).metadata.creationTimestamp);
      const noDate = makeResource({
        metadata: { name: 'nd', uid: '1', resourceVersion: '1' },
      });
      const withDate = makeResource({
        metadata: {
          name: 'wd',
          uid: '2',
          resourceVersion: '1',
          creationTimestamp: '2020-01-01T00:00:00Z',
        },
      });

      expect(sorter(noDate, withDate)).toBeLessThan(0);
    });
  });

  describe('reverseSorter', () => {
    it('should reverse the order of the wrapped sorter', () => {
      const ascending = sortByString((r) => (r as any).metadata.name);
      const descending = reverseSorter(ascending);

      const a = makeResource({
        metadata: { name: 'alpha', uid: '1', resourceVersion: '1' },
      });
      const b = makeResource({
        metadata: { name: 'zeta', uid: '2', resourceVersion: '1' },
      });

      // ascending: alpha < zeta → negative
      expect(ascending(a, b)).toBeLessThan(0);
      // descending: alpha > zeta → positive
      expect(descending(a, b)).toBeGreaterThan(0);
      expect(descending(b, a)).toBeLessThan(0);
    });

    it('should return 0 for equal elements after reversal', () => {
      const ascending = sortByNumber((r) => 5);
      const descending = reverseSorter(ascending);
      const r = makeResource();
      expect(descending(r, r)).toBe(0);
    });
  });
});
