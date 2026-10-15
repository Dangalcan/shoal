import { describe, it, expect } from 'vitest';
import * as guards from '../../lib/type-guards';
import {
  mockPods,
  mockDeployments,
  mockNodes,
  mockPVC,
  mockPV,
  mockJobs,
} from '../fixtures/k8s-resources';

describe('Type Guards', () => {
  it('isPod correctly identifies pods', () => {
    expect(guards.isPod(mockPods[0]!)).toBe(true);
    expect(guards.isPod(mockDeployments[0]! as any)).toBe(false);
  });

  it('isJob correctly identifies jobs', () => {
    expect(guards.isJob(mockJobs[0]!)).toBe(true);
    expect(guards.isJob(mockPods[0]! as any)).toBe(false);
  });

  it('isPersistentVolumeClaim correctly identifies PVCs', () => {
    expect(guards.isPersistentVolumeClaim(mockPVC[0]!)).toBe(true);
    expect(guards.isPersistentVolumeClaim(mockPV[0]! as any)).toBe(false);
  });

  it('isNode correctly identifies nodes', () => {
    expect(guards.isNode(mockNodes[0]!)).toBe(true);
    expect(guards.isNode(mockPods[0]! as any)).toBe(false);
  });

  it('isRecord accepts plain objects only', () => {
    expect(guards.isRecord({ a: 1 })).toBe(true);
    expect(guards.isRecord(Object.create(null))).toBe(true);
    expect(guards.isRecord([])).toBe(false);
    expect(guards.isRecord(null)).toBe(false);
    expect(guards.isRecord('text')).toBe(false);
    expect(guards.isRecord(undefined)).toBe(false);
  });

  it('stringField reads top-level string fields and nothing else', () => {
    expect(guards.stringField({ type: 'ClusterIP' }, 'type')).toBe('ClusterIP');
    expect(guards.stringField({ ports: [80] }, 'ports')).toBeUndefined();
    expect(guards.stringField({ type: 'x' }, 'missing')).toBeUndefined();
    expect(guards.stringField(null, 'type')).toBeUndefined();
    expect(guards.stringField(['type'], 'type')).toBeUndefined();
  });
});
