import { describe, it, expect } from 'vitest';
import * as guards from '../../lib/type-guards';
import {
  mockPods,
  mockDeployments,
  mockServices,
  mockNodes,
  mockPVC,
  mockNamespaces,
  mockConfigMaps,
  mockSecrets,
  mockStatefulSets,
  mockDaemonSets,
  mockReplicaSets,
  mockJobs,
  mockCronJobs,
  mockPV,
  mockIngress,
  mockHPA,
} from '../fixtures/k8s-resources';

describe('Type Guards', () => {
  it('isPod correctly identifies pods', () => {
    expect(guards.isPod(mockPods[0]!)).toBe(true);
    expect(guards.isPod(mockDeployments[0]! as any)).toBe(false);
  });

  it('isDeployment correctly identifies deployments', () => {
    expect(guards.isDeployment(mockDeployments[0]!)).toBe(true);
    expect(guards.isDeployment(mockPods[0]! as any)).toBe(false);
  });

  it('isService correctly identifies services', () => {
    expect(guards.isService(mockServices[0]!)).toBe(true);
    expect(guards.isService(mockNodes[0]! as any)).toBe(false);
  });

  it('isStatefulSet correctly identifies statefulsets', () => {
    expect(guards.isStatefulSet(mockStatefulSets[0]!)).toBe(true);
    expect(guards.isStatefulSet(mockPods[0]! as any)).toBe(false);
  });

  it('isDaemonSet correctly identifies daemonsets', () => {
    expect(guards.isDaemonSet(mockDaemonSets[0]!)).toBe(true);
    expect(guards.isDaemonSet(mockPods[0]! as any)).toBe(false);
  });

  it('isReplicaSet correctly identifies replicasets', () => {
    expect(guards.isReplicaSet(mockReplicaSets[0]!)).toBe(true);
    expect(guards.isReplicaSet(mockPods[0]! as any)).toBe(false);
  });

  it('isJob correctly identifies jobs', () => {
    expect(guards.isJob(mockJobs[0]!)).toBe(true);
    expect(guards.isJob(mockPods[0]! as any)).toBe(false);
  });

  it('isCronJob correctly identifies cronjobs', () => {
    expect(guards.isCronJob(mockCronJobs[0]!)).toBe(true);
    expect(guards.isCronJob(mockPods[0]! as any)).toBe(false);
  });

  it('isPersistentVolume correctly identifies PVs', () => {
    expect(guards.isPersistentVolume(mockPV[0]!)).toBe(true);
    expect(guards.isPersistentVolume(mockPVC[0]! as any)).toBe(false);
  });

  it('isPersistentVolumeClaim correctly identifies PVCs', () => {
    expect(guards.isPersistentVolumeClaim(mockPVC[0]!)).toBe(true);
    expect(guards.isPersistentVolumeClaim(mockPV[0]! as any)).toBe(false);
  });

  it('isNode correctly identifies nodes', () => {
    expect(guards.isNode(mockNodes[0]!)).toBe(true);
    expect(guards.isNode(mockPods[0]! as any)).toBe(false);
  });

  it('isConfigMap correctly identifies configmaps', () => {
    expect(guards.isConfigMap(mockConfigMaps[0]!)).toBe(true);
    expect(guards.isConfigMap(mockPods[0]! as any)).toBe(false);
  });

  it('isSecret correctly identifies secrets', () => {
    expect(guards.isSecret(mockSecrets[0]!)).toBe(true);
    expect(guards.isSecret(mockConfigMaps[0]! as any)).toBe(false);
  });

  it('isIngress correctly identifies ingresses', () => {
    expect(guards.isIngress(mockIngress[0]!)).toBe(true);
    expect(guards.isIngress(mockPods[0]! as any)).toBe(false);
  });

  it('isHorizontalPodAutoscaler correctly identifies HPAs', () => {
    expect(guards.isHorizontalPodAutoscaler(mockHPA[0]!)).toBe(true);
    expect(guards.isHorizontalPodAutoscaler(mockPods[0]! as any)).toBe(false);
  });

  it('hasNestedProperty safely checks deeply nested fields', () => {
    const obj = { a: { b: { c: 1 } } };
    expect(guards.hasNestedProperty(obj, 'a.b.c')).toBe(true);
    expect(guards.hasNestedProperty(obj, 'a.b.d')).toBe(false);
    expect(guards.hasNestedProperty(obj, 'x.y.z')).toBe(false);
    expect(guards.hasNestedProperty(null, 'a')).toBe(false);
  });
});
