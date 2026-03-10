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
  sortByUpdatedReplicas,
  sortByAvailableReplicas,
  sortByNodeRoles,
  sortByKubeletVersion,
  sortByOSImage,
  sortByKernelVersion,
  sortByContainerRuntime,
  sortByDataCount,
  sortByInternalIP,
  sortByExternalIP,
  sortByContainers,
  sortByImages,
  sortBySelector,
} from '../../../lib/sorting/resourceSorters';
import {
  Pod,
  Node,
  Deployment,
  DaemonSet,
  ConfigMap,
} from '../../../types/k8s-types';

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

    it('sortByReplicas treats missing status as 0', () => {
      const d1 = { status: {} } as unknown as Deployment;
      const d2 = { status: { replicas: 3 } } as unknown as Deployment;
      expect(sortByReplicas(d1, d2)).toBe(-3);
    });

    it('sortByReadyReplicas compares ready replicas', () => {
      const d1 = { status: { readyReplicas: 1 } } as unknown as Deployment;
      const d2 = { status: { readyReplicas: 3 } } as unknown as Deployment;
      expect(sortByReadyReplicas(d1, d2)).toBe(-2);
    });

    it('sortByReadyReplicas uses numberReady for DaemonSets', () => {
      const ds1 = { status: { numberReady: 2 } } as unknown as DaemonSet;
      const ds2 = { status: { numberReady: 5 } } as unknown as DaemonSet;
      expect(sortByReadyReplicas(ds1, ds2)).toBe(-3);
    });

    it('sortByUpdatedReplicas compares updatedReplicas', () => {
      const d1 = { status: { updatedReplicas: 1 } } as unknown as Deployment;
      const d2 = { status: { updatedReplicas: 4 } } as unknown as Deployment;
      expect(sortByUpdatedReplicas(d1, d2)).toBe(-3);
    });

    it('sortByUpdatedReplicas uses updatedNumberScheduled for DaemonSets', () => {
      const ds1 = {
        status: { updatedNumberScheduled: 3 },
      } as unknown as DaemonSet;
      const ds2 = {
        status: { updatedNumberScheduled: 6 },
      } as unknown as DaemonSet;
      expect(sortByUpdatedReplicas(ds1, ds2)).toBe(-3);
    });

    it('sortByAvailableReplicas compares availableReplicas', () => {
      const d1 = { status: { availableReplicas: 2 } } as unknown as Deployment;
      const d2 = { status: { availableReplicas: 8 } } as unknown as Deployment;
      expect(sortByAvailableReplicas(d1, d2)).toBe(-6);
    });

    it('sortByAvailableReplicas uses numberAvailable for DaemonSets', () => {
      const ds1 = { status: { numberAvailable: 1 } } as unknown as DaemonSet;
      const ds2 = { status: { numberAvailable: 4 } } as unknown as DaemonSet;
      expect(sortByAvailableReplicas(ds1, ds2)).toBe(-3);
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

    it('sortByNodeRoles treats missing labels as empty string', () => {
      const n1 = { metadata: {} } as unknown as Node;
      const n2 = { metadata: {} } as unknown as Node;
      expect(sortByNodeRoles(n1, n2)).toBe(0);
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

    it('sortByOSImage compares OS images', () => {
      const n1 = {
        status: { nodeInfo: { osImage: 'Alpine Linux' } },
      } as unknown as Node;
      const n2 = {
        status: { nodeInfo: { osImage: 'Ubuntu 22.04' } },
      } as unknown as Node;
      expect(sortByOSImage(n1, n2)).toBeLessThan(0);
    });

    it('sortByOSImage treats missing nodeInfo as empty string', () => {
      const n1 = { status: {} } as unknown as Node;
      const n2 = { status: {} } as unknown as Node;
      expect(sortByOSImage(n1, n2)).toBe(0);
    });

    it('sortByKernelVersion compares kernel versions', () => {
      const n1 = {
        status: { nodeInfo: { kernelVersion: '5.10.0' } },
      } as unknown as Node;
      const n2 = {
        status: { nodeInfo: { kernelVersion: '5.15.0' } },
      } as unknown as Node;
      expect(sortByKernelVersion(n1, n2)).toBeLessThan(0);
    });

    it('sortByContainerRuntime compares runtimes', () => {
      const n1 = {
        status: { nodeInfo: { containerRuntimeVersion: 'containerd://1.5.0' } },
      } as unknown as Node;
      const n2 = {
        status: { nodeInfo: { containerRuntimeVersion: 'docker://20.10' } },
      } as unknown as Node;
      expect(sortByContainerRuntime(n1, n2)).toBeLessThan(0);
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

    it('sortByInternalIP returns empty string when no InternalIP address exists', () => {
      const n1 = {
        status: { addresses: [{ type: 'ExternalIP', address: '1.2.3.4' }] },
      } as unknown as Node;
      const n2 = { status: { addresses: [] } } as unknown as Node;
      expect(sortByInternalIP(n1, n2)).toBe(0);
    });

    it('sortByExternalIP finds and compares ExternalIP', () => {
      const n1 = {
        status: { addresses: [{ type: 'ExternalIP', address: '10.0.0.1' }] },
      } as unknown as Node;
      const n2 = {
        status: { addresses: [{ type: 'ExternalIP', address: '10.0.0.2' }] },
      } as unknown as Node;
      expect(sortByExternalIP(n1, n2)).toBeLessThan(0);
    });

    it('sortByExternalIP returns empty string when no ExternalIP address exists', () => {
      const n1 = { status: { addresses: [] } } as unknown as Node;
      const n2 = { status: { addresses: [] } } as unknown as Node;
      expect(sortByExternalIP(n1, n2)).toBe(0);
    });
  });

  describe('Data Sorters', () => {
    it('sortByDataCount counts keys in data', () => {
      const c1 = { data: { key1: 'val', key2: 'val' } } as unknown as ConfigMap;
      const c2 = { data: { key1: 'val' } } as unknown as ConfigMap;
      // 2 > 1, so c1 - c2 = 1
      expect(sortByDataCount(c1, c2)).toBe(1);
    });

    it('sortByDataCount falls back to binaryData when data is absent', () => {
      const c1 = {
        binaryData: { bin1: 'x', bin2: 'y' },
      } as unknown as ConfigMap;
      const c2 = { data: { key1: 'val' } } as unknown as ConfigMap;
      expect(sortByDataCount(c1, c2)).toBe(1);
    });

    it('sortByDataCount returns 0 for empty resources', () => {
      const c1 = {} as unknown as ConfigMap;
      const c2 = {} as unknown as ConfigMap;
      expect(sortByDataCount(c1, c2)).toBe(0);
    });
  });

  describe('Container / Image / Selector Sorters', () => {
    it('sortByContainers compares container names joined', () => {
      const d1 = { spec: { containers: [{ name: 'alpha' }] } } as any;
      const d2 = { spec: { containers: [{ name: 'zeta' }] } } as any;
      expect(sortByContainers(d1, d2)).toBeLessThan(0);
    });

    it('sortByContainers checks template.spec for workloads', () => {
      const d1 = {
        spec: { template: { spec: { containers: [{ name: 'alpha' }] } } },
      } as any;
      const d2 = {
        spec: { template: { spec: { containers: [{ name: 'zeta' }] } } },
      } as any;
      expect(sortByContainers(d1, d2)).toBeLessThan(0);
    });

    it('sortByContainers returns empty string when no containers', () => {
      const d1 = { spec: {} } as any;
      const d2 = { spec: {} } as any;
      expect(sortByContainers(d1, d2)).toBe(0);
    });

    it('sortByImages compares image names joined', () => {
      const d1 = { spec: { containers: [{ image: 'nginx:1.19' }] } } as any;
      const d2 = { spec: { containers: [{ image: 'redis:6' }] } } as any;
      expect(sortByImages(d1, d2)).toBeLessThan(0);
    });

    it('sortByImages returns empty string when no containers', () => {
      const d1 = { spec: {} } as any;
      const d2 = { spec: {} } as any;
      expect(sortByImages(d1, d2)).toBe(0);
    });

    it('sortBySelector compares selector matchLabels as JSON', () => {
      const s1 = {
        spec: { selector: { matchLabels: { app: 'alpha' } } },
      } as any;
      const s2 = {
        spec: { selector: { matchLabels: { app: 'zeta' } } },
      } as any;
      expect(sortBySelector(s1, s2)).toBeLessThan(0);
    });

    it('sortBySelector returns empty string when selector is empty', () => {
      const s1 = { spec: { selector: {} } } as any;
      const s2 = { spec: { selector: {} } } as any;
      expect(sortBySelector(s1, s2)).toBe(0);
    });

    it('sortBySelector returns empty string when no spec', () => {
      const s1 = {} as any;
      const s2 = {} as any;
      expect(sortBySelector(s1, s2)).toBe(0);
    });
  });

  describe('getStatusSorter – edge cases', () => {
    it('should return empty string for resource with no status', () => {
      const sorter = getStatusSorter('pods');
      const r1 = createPod({ status: undefined });
      const r2 = createPod({ status: undefined });
      expect(sorter(r1, r2)).toBe(0);
    });

    it('should return empty string when conditions array is empty', () => {
      const sorter = getStatusSorter('deployments');
      const r1 = { status: { conditions: [] } } as any;
      const r2 = { status: { conditions: [] } } as any;
      expect(sorter(r1, r2)).toBe(0);
    });
  });

  describe('sortByRestarts – non-pod resource', () => {
    it('should return 0 for non-pod resources', () => {
      const d1 = { kind: 'Deployment', status: {} } as any;
      const d2 = { kind: 'Deployment', status: {} } as any;
      expect(sortByRestarts(d1, d2)).toBe(0);
    });
  });
});
