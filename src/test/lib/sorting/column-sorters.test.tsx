import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getSorterForColumn, hasColumnSorter } from '../../../lib/sorting';
import { RESOURCE_CONFIGS } from '../../../lib/resources/resource-configs';
import { renderCell } from '../../../components/resource-tables/cell-renderers/renderCell';
import type { ResourceType } from '../../../lib/resources/resource-definitions';
import type { K8sResource } from '../../../types/k8s-types';

const object = (fields: object): K8sResource =>
  ({
    metadata: { name: 'r', creationTimestamp: '2026-01-01T00:00:00Z' },
    ...fields,
  }) as unknown as K8sResource;

const spec = (fields: object) => object({ spec: fields });
const status = (fields: object) => object({ status: fields });
const annotated = (annotations: object) =>
  object({
    metadata: {
      name: 'r',
      creationTimestamp: '2026-01-01T00:00:00Z',
      annotations,
    },
  });

/** What the table shows for a column of a resource. */
function cellText(
  resourceType: ResourceType,
  colId: string,
  resource: K8sResource
): string {
  const { unmount } = render(
    <table>
      <tbody>
        <tr data-testid="row">
          {renderCell({ colId, resource, resourceType, style: {} })}
        </tr>
      </tbody>
    </table>
  );
  const text = screen.getByTestId('row').textContent ?? '';
  unmount();
  return text;
}

const metric = (name: string, value: number) => ({
  resource: { name, current: { averageUtilization: value } },
});
const hpa = (current: number) =>
  object({
    spec: {
      metrics: [{ resource: { target: { averageUtilization: 80 } } }],
    },
    status: { currentMetrics: [metric('cpu', current)] },
  });
const lb = (entries: object[]) =>
  status({ loadBalancer: { ingress: entries } });
const job = (start: string, end: string) =>
  status({ startTime: start, completionTime: end });

/**
 * Every column that has a cell of its own and used to fall through to a sort
 * on a field the object does not have. Each row is two objects as the API
 * returns them, in the order the column must put them, with the text the cell
 * shows for each, so the sort and the cell are held to the same values.
 */
const COLUMNS: [
  ResourceType,
  string,
  K8sResource,
  string,
  K8sResource,
  string,
][] = [
  [
    'pods',
    'nominated-node',
    status({ nominatedNodeName: 'a' }),
    'a',
    status({ nominatedNodeName: 'b' }),
    'b',
  ],
  [
    'pods',
    'readiness-gates',
    spec({ readinessGates: [{ conditionType: 'a' }] }),
    'a',
    spec({ readinessGates: [{ conditionType: 'b' }] }),
    'b',
  ],
  [
    'replicasets',
    'desired',
    spec({ replicas: 2 }),
    '2',
    spec({ replicas: 10 }),
    '10',
  ],
  [
    'replicationcontroller',
    'desired',
    spec({ replicas: 2 }),
    '2',
    spec({ replicas: 10 }),
    '10',
  ],
  [
    'daemonsets',
    'desired',
    status({ desiredNumberScheduled: 2 }),
    '2',
    status({ desiredNumberScheduled: 10 }),
    '10',
  ],
  [
    'jobs',
    'completions',
    object({ spec: { completions: 5 }, status: { succeeded: 2 } }),
    '2 / 5',
    object({ spec: { completions: 5 }, status: { succeeded: 3 } }),
    '3 / 5',
  ],
  [
    'jobs',
    'duration',
    job('2026-01-01T00:00:00Z', '2026-01-01T00:00:09Z'),
    '9s',
    job('2026-01-01T00:00:00Z', '2026-01-01T00:01:40Z'),
    '100s',
  ],
  [
    'cronjobs',
    'schedule',
    spec({ schedule: '0 1 * * *' }),
    '0 1 * * *',
    spec({ schedule: '0 2 * * *' }),
    '0 2 * * *',
  ],
  [
    'cronjobs',
    'last-schedule',
    status({ lastScheduleTime: '2026-01-01T00:00:00Z' }),
    '2026-01-01T00:00:00Z',
    status({ lastScheduleTime: '2026-02-01T00:00:00Z' }),
    '2026-02-01T00:00:00Z',
  ],
  [
    'services',
    'type',
    spec({}),
    'ClusterIP',
    spec({ type: 'NodePort' }),
    'NodePort',
  ],
  [
    'services',
    'cluster-ip',
    spec({ clusterIP: '10.96.0.9' }),
    '10.96.0.9',
    spec({ clusterIP: '10.96.0.10' }),
    '10.96.0.10',
  ],
  [
    'services',
    'external-ip',
    lb([{ ip: '10.0.0.1' }]),
    '10.0.0.1',
    lb([{ hostname: 'lb.example.com' }]),
    'lb.example.com',
  ],
  [
    'services',
    'ports',
    spec({ ports: [{ port: 80, protocol: 'TCP' }] }),
    '80/TCP',
    spec({ ports: [{ port: 443 }] }),
    '443',
  ],
  [
    'hpa',
    'reference',
    spec({ scaleTargetRef: { kind: 'Deployment', name: 'a' } }),
    'Deployment/a',
    spec({ scaleTargetRef: { kind: 'Deployment', name: 'b' } }),
    'Deployment/b',
  ],
  ['hpa', 'targets', hpa(9), '9% / 80%', hpa(50), '50% / 80%'],
  [
    'hpa',
    'minpods',
    spec({ minReplicas: 2 }),
    '2',
    spec({ minReplicas: 10 }),
    '10',
  ],
  [
    'hpa',
    'maxpods',
    spec({ maxReplicas: 2 }),
    '2',
    spec({ maxReplicas: 10 }),
    '10',
  ],
  [
    'hpa',
    'replicas',
    status({ currentReplicas: 2 }),
    '2',
    status({ currentReplicas: 10 }),
    '10',
  ],
  [
    'persistentvolume',
    'capacity',
    spec({ capacity: { storage: '500Mi' } }),
    '500Mi',
    spec({ capacity: { storage: '2Gi' } }),
    '2Gi',
  ],
  [
    'persistentvolume',
    'access-modes',
    spec({ accessModes: ['ReadOnlyMany'] }),
    'ReadOnlyMany',
    spec({ accessModes: ['ReadWriteOnce'] }),
    'ReadWriteOnce',
  ],
  [
    'persistentvolume',
    'reclaim-policy',
    spec({}),
    'Delete',
    spec({ persistentVolumeReclaimPolicy: 'Retain' }),
    'Retain',
  ],
  [
    'persistentvolume',
    'claim',
    spec({ claimRef: { namespace: 'a', name: 'x' } }),
    'a/x',
    spec({ claimRef: { namespace: 'b', name: 'x' } }),
    'b/x',
  ],
  [
    'persistentvolume',
    'storageclass',
    spec({ storageClassName: 'a' }),
    'a',
    spec({ storageClassName: 'b' }),
    'b',
  ],
  [
    'persistentvolume',
    'volumemode',
    spec({ volumeMode: 'Block' }),
    'Block',
    spec({}),
    'Filesystem',
  ],
  [
    'persistentvolumeclaim',
    'volume',
    spec({ volumeName: 'a' }),
    'a',
    spec({ volumeName: 'b' }),
    'b',
  ],
  [
    'persistentvolumeclaim',
    'capacity',
    status({ capacity: { storage: '500Mi' } }),
    '500Mi',
    status({ capacity: { storage: '2Gi' } }),
    '2Gi',
  ],
  [
    'persistentvolumeclaim',
    'access-modes',
    spec({ accessModes: ['ReadOnlyMany'] }),
    'ReadOnlyMany',
    spec({ accessModes: ['ReadWriteOnce'] }),
    'ReadWriteOnce',
  ],
  [
    'persistentvolumeclaim',
    'storageclass',
    spec({ storageClassName: 'a' }),
    'a',
    spec({ storageClassName: 'b' }),
    'b',
  ],
  [
    'persistentvolumeclaim',
    'volumemode',
    spec({ volumeMode: 'Block' }),
    'Block',
    spec({}),
    'Filesystem',
  ],
  [
    'persistentvolumeclaim',
    'selected-node',
    annotated({ 'volume.kubernetes.io/selected-node': 'a' }),
    'a',
    annotated({ 'volume.kubernetes.io/selected-node': 'b' }),
    'b',
  ],
  [
    'persistentvolumeclaim',
    'vac',
    spec({ volumeAttributesClassName: 'a' }),
    'a',
    spec({ volumeAttributesClassName: 'b' }),
    'b',
  ],
  [
    'ingress',
    'class',
    annotated({ 'kubernetes.io/ingress.class': 'a' }),
    'a',
    spec({ ingressClassName: 'b' }),
    'b',
  ],
  [
    'ingress',
    'hosts',
    spec({ rules: [{}] }),
    '*',
    spec({ rules: [{ host: 'a.example.com' }] }),
    'a.example.com',
  ],
  [
    'ingress',
    'address',
    lb([{ ip: '10.0.0.1' }]),
    '10.0.0.1',
    lb([{ hostname: 'lb.example.com' }]),
    'lb.example.com',
  ],
  [
    'ingress',
    'ports',
    spec({}),
    '80',
    spec({ rules: [{}], tls: [{}] }),
    '80, 443',
  ],
  [
    'secrets',
    'type',
    object({ type: 'kubernetes.io/tls' }),
    'kubernetes.io/tls',
    object({ type: 'Opaque' }),
    'Opaque',
  ],
  [
    'storageclass',
    'provisioner',
    object({ provisioner: 'a' }),
    'a',
    object({ provisioner: 'b' }),
    'b',
  ],
  [
    'storageclass',
    'reclaim-policy',
    object({}),
    'Delete',
    object({ reclaimPolicy: 'Retain' }),
    'Retain',
  ],
  [
    'storageclass',
    'binding-mode',
    object({ volumeBindingMode: 'Immediate' }),
    'Immediate',
    object({ volumeBindingMode: 'WaitForFirstConsumer' }),
    'WaitForFirstConsumer',
  ],
  [
    'storageclass',
    'allow-expansion',
    object({}),
    'false',
    object({ allowVolumeExpansion: true }),
    'true',
  ],
];

describe('sorting the resource tables', () => {
  it('has a sorter for every column of every kind', () => {
    const missing = RESOURCE_CONFIGS.flatMap((config) =>
      config.columns
        .filter((col) => !hasColumnSorter(col.id, config.id as ResourceType))
        .map((col) => `${config.id}.${col.id}`)
    );
    expect(missing).toEqual([]);
  });

  it('leaves the order alone for a column no table declares', () => {
    const sorter = getSorterForColumn('no-such-column', 'pods');
    expect(hasColumnSorter('no-such-column', 'pods')).toBe(false);
    expect(sorter(object({}), object({}))).toBe(0);
  });

  it.each(COLUMNS)(
    '%s.%s orders its values and matches the cell',
    (resourceType, colId, low, lowText, high, highText) => {
      expect(cellText(resourceType, colId, low)).toBe(lowText);
      expect(cellText(resourceType, colId, high)).toBe(highText);

      const sorter = getSorterForColumn(colId, resourceType);
      expect(sorter(low, high)).toBeLessThan(0);
      expect(sorter(high, low)).toBeGreaterThan(0);
    }
  );

  it.each([
    ['persistentvolume', 'capacity', spec({ capacity: { storage: '1Gi' } })],
    ['services', 'external-ip', lb([{ ip: '10.0.0.1' }])],
    ['ingress', 'address', lb([{ ip: '10.0.0.1' }])],
    ['hpa', 'targets', hpa(9)],
    ['jobs', 'duration', job('2026-01-01T00:00:00Z', '2026-01-01T00:00:09Z')],
    ['pods', 'nominated-node', status({ nominatedNodeName: 'a' })],
  ] as [ResourceType, string, K8sResource][])(
    '%s.%s puts a resource without a value last',
    (resourceType, colId, withValue) => {
      const sorter = getSorterForColumn(colId, resourceType);
      expect(sorter(withValue, object({}))).toBeLessThan(0);
      expect(sorter(object({}), withValue)).toBeGreaterThan(0);
    }
  );

  it('sorts a running Job by the time it has run so far', () => {
    const sorter = getSorterForColumn('duration', 'jobs');
    const older = status({ startTime: '2026-01-01T00:00:00Z' });
    const newer = status({ startTime: new Date().toISOString() });
    expect(sorter(newer, older)).toBeLessThan(0);
  });

  it('leaves an HPA without a target metric among the unknown', () => {
    const sorter = getSorterForColumn('targets', 'hpa');
    const noTarget = status({ currentMetrics: [metric('cpu', 1)] });
    expect(cellText('hpa', 'targets', noTarget)).toBe('<unknown>');
    expect(sorter(hpa(99), noTarget)).toBeLessThan(0);
  });
});
