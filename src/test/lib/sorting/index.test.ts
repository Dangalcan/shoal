import { describe, it, expect } from 'vitest';
import { getSorterForColumn } from '../../../lib/sorting';
import type { K8sResource } from '../../../types/k8s-types';

const makeResource = (name: string, extra: any = {}): K8sResource =>
  ({
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
      name,
      uid: name,
      resourceVersion: '1',
      creationTimestamp: '2024-01-01T00:00:00Z',
      namespace: 'default',
    },
    spec: { containers: [] },
    status: {},
    ...extra,
  }) as unknown as K8sResource;

describe('getSorterForColumn', () => {
  it('name – sorts alphabetically', () => {
    const sorter = getSorterForColumn('name', 'pods');
    const a = makeResource('alpha');
    const b = makeResource('zeta');
    expect(sorter(a, b)).toBeLessThan(0);
    expect(sorter(b, a)).toBeGreaterThan(0);
  });

  it('namespace – sorts by namespace', () => {
    const sorter = getSorterForColumn('namespace', 'pods');
    const a = makeResource('p1', {
      metadata: {
        name: 'p1',
        uid: '1',
        resourceVersion: '1',
        namespace: 'aaa',
      },
    });
    const b = makeResource('p2', {
      metadata: {
        name: 'p2',
        uid: '2',
        resourceVersion: '1',
        namespace: 'zzz',
      },
    });
    expect(sorter(a, b)).toBeLessThan(0);
  });

  it('age – sorts by creation timestamp', () => {
    const sorter = getSorterForColumn('age', 'pods');
    const old = makeResource('old', {
      metadata: {
        name: 'old',
        uid: '1',
        resourceVersion: '1',
        creationTimestamp: '2020-01-01T00:00:00Z',
      },
    });
    const young = makeResource('young', {
      metadata: {
        name: 'young',
        uid: '2',
        resourceVersion: '1',
        creationTimestamp: '2024-01-01T00:00:00Z',
      },
    });
    expect(sorter(old, young)).toBeLessThan(0);
  });

  it('status – returns a sorter function', () => {
    const sorter = getSorterForColumn('status', 'pods');
    expect(typeof sorter).toBe('function');
  });

  it('restarts – returns a sorter function', () => {
    const sorter = getSorterForColumn('restarts', 'pods');
    expect(typeof sorter).toBe('function');
  });

  it('ip – returns a sorter function', () => {
    const sorter = getSorterForColumn('ip', 'pods');
    expect(typeof sorter).toBe('function');
  });

  it('node – returns a sorter function', () => {
    const sorter = getSorterForColumn('node', 'pods');
    expect(typeof sorter).toBe('function');
  });

  it('replicas – sorts by replicas', () => {
    const sorter = getSorterForColumn('replicas', 'deployments');
    const low = { ...makeResource('d1'), status: { replicas: 1 } } as any;
    const high = { ...makeResource('d2'), status: { replicas: 5 } } as any;
    expect(sorter(low, high)).toBeLessThan(0);
  });

  it('current – maps to replicas sorter', () => {
    const sorter = getSorterForColumn('current', 'daemonsets');
    expect(typeof sorter).toBe('function');
  });

  it('ready – returns a sorter function', () => {
    const sorter = getSorterForColumn('ready', 'deployments');
    expect(typeof sorter).toBe('function');
  });

  it('updated – returns a sorter function', () => {
    const sorter = getSorterForColumn('updated', 'deployments');
    expect(typeof sorter).toBe('function');
  });

  it('available – returns a sorter function', () => {
    const sorter = getSorterForColumn('available', 'deployments');
    expect(typeof sorter).toBe('function');
  });

  it('data – returns a sorter function', () => {
    const sorter = getSorterForColumn('data', 'configmaps');
    expect(typeof sorter).toBe('function');
  });

  it('roles – returns a sorter function', () => {
    const sorter = getSorterForColumn('roles', 'nodes');
    expect(typeof sorter).toBe('function');
  });

  it('version – returns a sorter function', () => {
    const sorter = getSorterForColumn('version', 'nodes');
    expect(typeof sorter).toBe('function');
  });

  it('os-image – returns a sorter function', () => {
    const sorter = getSorterForColumn('os-image', 'nodes');
    expect(typeof sorter).toBe('function');
  });

  it('kernel-version – returns a sorter function', () => {
    const sorter = getSorterForColumn('kernel-version', 'nodes');
    expect(typeof sorter).toBe('function');
  });

  it('container-runtime – returns a sorter function', () => {
    const sorter = getSorterForColumn('container-runtime', 'nodes');
    expect(typeof sorter).toBe('function');
  });

  it('internal-ip – returns a sorter function', () => {
    const sorter = getSorterForColumn('internal-ip', 'nodes');
    expect(typeof sorter).toBe('function');
  });

  it('external-ip – returns a sorter function', () => {
    const sorter = getSorterForColumn('external-ip', 'nodes');
    expect(typeof sorter).toBe('function');
  });

  it('containers – returns a sorter function', () => {
    const sorter = getSorterForColumn('containers', 'pods');
    expect(typeof sorter).toBe('function');
  });

  it('images – returns a sorter function', () => {
    const sorter = getSorterForColumn('images', 'pods');
    expect(typeof sorter).toBe('function');
  });

  it('selector – returns a sorter function', () => {
    const sorter = getSorterForColumn('selector', 'services');
    expect(typeof sorter).toBe('function');
  });

  describe('default fallback', () => {
    it('should sort by root property when column is unknown', () => {
      const sorter = getSorterForColumn('customField', 'pods');
      const a = { ...makeResource('p1'), customField: 'apple' } as any;
      const b = { ...makeResource('p2'), customField: 'banana' } as any;
      expect(sorter(a, b)).toBeLessThan(0);
      expect(sorter(b, a)).toBeGreaterThan(0);
    });

    it('should return 0 for equal custom field values', () => {
      const sorter = getSorterForColumn('customField', 'pods');
      const a = { ...makeResource('p1'), customField: 'same' } as any;
      const b = { ...makeResource('p2'), customField: 'same' } as any;
      expect(sorter(a, b)).toBe(0);
    });

    it('should treat missing custom field as empty string', () => {
      const sorter = getSorterForColumn('missingField', 'pods');
      const a = makeResource('p1');
      const b = makeResource('p2');
      expect(sorter(a, b)).toBe(0);
    });
  });
  describe('field columns', () => {
    /** Sorts resources ascending, as the table does, and lists their names. */
    const sortedNames = (
      columnId: string,
      resourceType: Parameters<typeof getSorterForColumn>[1],
      items: K8sResource[]
    ) =>
      [...items]
        .sort(getSorterForColumn(columnId, resourceType))
        .map((item) => item.metadata.name);

    it('sorts a numeric field numerically, missing values last', () => {
      const names = sortedNames('value', 'priorityclass', [
        makeResource('high', { value: 2000001000 }),
        makeResource('none'),
        makeResource('low', { value: 1000 }),
        makeResource('mid', { value: 100000 }),
      ]);
      expect(names).toEqual(['low', 'mid', 'high', 'none']);
    });

    it('sorts a duration by its seconds, not its text', () => {
      const names = sortedNames('duration', 'lease', [
        makeResource('long', { spec: { leaseDurationSeconds: 120 } }),
        makeResource('short', { spec: { leaseDurationSeconds: 15 } }),
      ]);
      expect(names).toEqual(['short', 'long']);
    });

    it('sorts a boolean field false before true', () => {
      const names = sortedNames('suspend', 'cronjobs', [
        makeResource('paused', { spec: { suspend: true } }),
        makeResource('running', { spec: { suspend: false } }),
        makeResource('default', { spec: {} }),
      ]);
      expect(names).toEqual(['running', 'default', 'paused']);
    });

    it('sorts the last-seen time chronologically', () => {
      const names = sortedNames('last-seen', 'events', [
        makeResource('latest', {
          lastTimestamp: '2026-10-31T12:00:00Z',
        }),
        makeResource('earliest', {
          lastTimestamp: '2026-10-30T09:00:00Z',
        }),
        makeResource('middle', {
          eventTime: '2026-10-31T08:30:00.000000Z',
        }),
      ]);
      expect(names).toEqual(['earliest', 'middle', 'latest']);
    });

    it('sorts a text field naturally', () => {
      const names = sortedNames('reason', 'events', [
        makeResource('e1', { reason: 'Pulled' }),
        makeResource('e2', { reason: 'BackOff' }),
        makeResource('e3'),
        makeResource('e4', { reason: 'Created' }),
      ]);
      expect(names).toEqual(['e2', 'e4', 'e1', 'e3']);
    });

    it('sorts a snapshot size by bytes', () => {
      const names = sortedNames('size', 'volumesnapshot', [
        makeResource('big', { status: { restoreSize: '2Gi' } }),
        makeResource('small', { status: { restoreSize: '500Mi' } }),
      ]);
      expect(names).toEqual(['small', 'big']);
    });

    it('takes the field over a shared case with the same id', () => {
      // `available` means available replicas for workloads; an APIService
      // sorts by its Available condition instead.
      const names = sortedNames('available', 'apiservice', [
        makeResource('up', {
          status: { conditions: [{ type: 'Available', status: 'True' }] },
        }),
        makeResource('down', {
          status: {
            conditions: [
              {
                type: 'Available',
                status: 'False',
                reason: 'FailedDiscoveryCheck',
              },
            ],
          },
        }),
      ]);
      expect(names).toEqual(['down', 'up']);
    });
  });
});
