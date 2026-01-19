import { describe, it, expect } from 'vitest';
import {
  sortByName,
  sortByNamespace,
  sortByAge,
  getStatusSorter,
  sortByRestarts,
  sortByIP,
  sortByNode,
  sortByReplicas,
  sortByReadyReplicas,
  sortByNodeRoles,
  sortByKubeletVersion,
  sortByDataCount,
  sortByInternalIP,
} from '../../../lib/sorting/resourceSorters';
import { Pod, Node, Deployment, ConfigMap } from '../../../types/k8s-types';

describe('resourceSorters', () => {
  const createMeta = (name: string, ns = '', creationTimestamp = '') => ({
    name,
    namespace: ns,
    creationTimestamp,
    uid: name,
    resourceVersion: '1',
  });

  const createPod = (overrides: any = {}): Pod =>
    ({
      kind: 'Pod',
      apiVersion: 'v1',
      metadata: createMeta('pod'),
      spec: { containers: [] },
      status: {},
      ...overrides,
    }) as unknown as Pod;

  it('sortByName should sort alphabetically', () => {
    const a = { metadata: createMeta('a-pod') } as any;
    const b = { metadata: createMeta('b-pod') } as any;
    expect(sortByName(a, b)).toBeLessThan(0);
    expect(sortByName(b, a)).toBeGreaterThan(0);
    expect(sortByName(a, a)).toBe(0);
  });

  it('sortByNamespace should sort by namespace', () => {
    const a = { metadata: createMeta('p1', 'default') } as any;
    const b = { metadata: createMeta('p2', 'kube-system') } as any;
    expect(sortByNamespace(a, b)).toBeLessThan(0);
    expect(sortByNamespace(b, a)).toBeGreaterThan(0);
  });

  it('sortByAge should sort by creation timestamp', () => {
    const old = {
      metadata: createMeta('old', '', '2023-01-01T00:00:00Z'),
    } as any;
    const young = {
      metadata: createMeta('young', '', '2024-01-01T00:00:00Z'),
    } as any;
    expect(sortByAge(old, young)).toBeLessThan(0);
  });

  describe('getStatusSorter', () => {
    it('should sort Pods by phase', () => {
      const pending = createPod({ status: { phase: 'Pending' } });
      const running = createPod({ status: { phase: 'Running' } });
      const sorter = getStatusSorter('pods');
      // "Pending" < "Running"
      expect(sorter(pending, running)).toBeLessThan(0);
    });

    it('should fallback to condition type for other resources', () => {
      const r1 = { status: { conditions: [{ type: 'Available' }] } } as any;
      const r2 = { status: { conditions: [{ type: 'Progressing' }] } } as any;
      const sorter = getStatusSorter('deployments');
      // "Available" < "Progressing"
      expect(sorter(r1, r2)).toBeLessThan(0);
    });
  });

  describe('Pod Sorters', () => {
    it('sortByRestarts handles container statuses', () => {
      const p1 = createPod({
        status: { containerStatuses: [{ restartCount: 5 }] },
      });
      const p2 = createPod({
        status: { containerStatuses: [{ restartCount: 10 }] },
      });
      expect(sortByRestarts(p1, p2)).toBe(-5);
    });

    it('sortByIP handles podIP', () => {
      const p1 = createPod({ status: { podIP: '10.0.0.1' } });
      const p2 = createPod({ status: { podIP: '10.0.0.2' } });
      expect(sortByIP(p1, p2)).toBeLessThan(0);
    });

    it('sortByNode handles nodeName', () => {
      const p1 = createPod({ spec: { nodeName: 'node-a', containers: [] } });
      const p2 = createPod({ spec: { nodeName: 'node-b', containers: [] } });
      expect(sortByNode(p1, p2)).toBeLessThan(0);
    });
  });

  describe('Workload Sorters', () => {
    it('sortByReplicas compares replicas', () => {
      const d1 = { status: { replicas: 2 } } as unknown as Deployment;
      const d2 = { status: { replicas: 5 } } as unknown as Deployment;
      expect(sortByReplicas(d1, d2)).toBe(-3);
    });

    it('sortByReadyReplicas compares ready replicas', () => {
      const d1 = { status: { readyReplicas: 1 } } as unknown as Deployment;
      const d2 = { status: { readyReplicas: 3 } } as unknown as Deployment;
      expect(sortByReadyReplicas(d1, d2)).toBe(-2);
    });
  });

  describe('Node Sorters', () => {
    it('sortByNodeRoles compares roles from labels', () => {
      const n1 = {
        metadata: { labels: { 'node-role.kubernetes.io/master': '' } },
      } as unknown as Node;
      const n2 = {
        metadata: { labels: { 'node-role.kubernetes.io/worker': '' } },
      } as unknown as Node;
      expect(sortByNodeRoles(n1, n2)).toBeLessThan(0);
    });

    it('sortByKubeletVersion compares versions', () => {
      const n1 = {
        status: { nodeInfo: { kubeletVersion: 'v1.20.0' } },
      } as unknown as Node;
      const n2 = {
        status: { nodeInfo: { kubeletVersion: 'v1.21.0' } },
      } as unknown as Node;
      expect(sortByKubeletVersion(n1, n2)).toBeLessThan(0);
    });

    it('sortByInternalIP finds and compares InternalIP', () => {
      const n1 = {
        status: { addresses: [{ type: 'InternalIP', address: '192.168.1.1' }] },
      } as unknown as Node;
      const n2 = {
        status: { addresses: [{ type: 'InternalIP', address: '192.168.1.2' }] },
      } as unknown as Node;
      expect(sortByInternalIP(n1, n2)).toBeLessThan(0);
    });
  });

  describe('Data Sorters', () => {
    it('sortByDataCount counts keys in data', () => {
      const c1 = { data: { key1: 'val', key2: 'val' } } as unknown as ConfigMap;
      const c2 = { data: { key1: 'val' } } as unknown as ConfigMap;
      // 2 > 1, so c1 - c2 = 1
      expect(sortByDataCount(c1, c2)).toBe(1);
    });
  });
});
