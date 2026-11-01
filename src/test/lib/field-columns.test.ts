import { describe, it, expect } from 'vitest';
import {
  MISSING_TEXT,
  compareFieldValues,
  fieldColumnText,
  formatFieldValue,
  getFieldColumn,
  toFieldValue,
  truncatedList,
  type FieldColumn,
} from '../../lib/resources/field-columns';
import type { ResourceType } from '../../lib/resources/resource-types';
import type { K8sResource } from '../../types/k8s-types';

const CREATED = '2026-10-01T08:00:00Z';

/** A resource of any kind: `fields` at the top level, extra metadata. */
const res = (
  fields: Record<string, unknown> = {},
  metadata: Record<string, unknown> = {}
): K8sResource =>
  ({
    metadata: { name: 'x', creationTimestamp: CREATED, ...metadata },
    ...fields,
  }) as K8sResource;

const column = (type: ResourceType, col: string): FieldColumn => {
  const found = getFieldColumn(type, col);
  if (!found) throw new Error(`no field column ${type}/${col}`);
  return found;
};

const textOf = (type: ResourceType, col: string, resource: K8sResource) =>
  fieldColumnText(column(type, col), resource);

const valueOf = (type: ResourceType, col: string, resource: K8sResource) =>
  column(type, col).value(resource);

interface Case {
  type: ResourceType;
  col: string;
  name: string;
  resource: K8sResource;
  text: string;
}

const local = (iso: string) => new Date(iso).toLocaleString();

const owner = (fields: Record<string, unknown>) =>
  res({}, { ownerReferences: [fields] });

const psa = (labels: Record<string, string>) => res({}, { labels });

const CASES: Case[] = [
  // DaemonSets
  {
    type: 'daemonsets',
    col: 'node-selector',
    name: 'labels sorted by key',
    resource: res({
      spec: {
        template: {
          spec: { nodeSelector: { 'kubernetes.io/os': 'linux', disk: 'ssd' } },
        },
      },
    }),
    text: 'disk=ssd,kubernetes.io/os=linux',
  },
  {
    type: 'daemonsets',
    col: 'node-selector',
    name: 'a non-string label value',
    resource: res({
      spec: { template: { spec: { nodeSelector: { odd: 1 } } } },
    }),
    text: 'odd=',
  },
  {
    type: 'daemonsets',
    col: 'node-selector',
    name: 'no node selector',
    resource: res({ spec: { template: { spec: {} } } }),
    text: MISSING_TEXT,
  },
  // EndpointSlices
  {
    type: 'endpointslices',
    col: 'address-type',
    name: 'top-level addressType',
    resource: res({ addressType: 'IPv4' }),
    text: 'IPv4',
  },
  {
    type: 'endpointslices',
    col: 'ports',
    name: 'number, else name, else *',
    resource: res({
      ports: [
        { name: 'dns', port: 53, protocol: 'UDP' },
        { name: 'metrics' },
        {},
      ],
    }),
    text: '53,metrics,*',
  },
  {
    type: 'endpointslices',
    col: 'ports',
    name: 'more than three ports',
    resource: res({
      ports: [80, 443, 8080, 8443, 9090].map((port) => ({ port })),
    }),
    text: '80,443,8080 + 2 more...',
  },
  {
    type: 'endpointslices',
    col: 'ports',
    name: 'no ports',
    resource: res(),
    text: MISSING_TEXT,
  },
  {
    type: 'endpointslices',
    col: 'endpoints',
    name: 'addresses of every endpoint, cut after three',
    resource: res({
      endpoints: [
        { addresses: ['10.244.0.5'], conditions: { ready: true } },
        { addresses: ['10.244.1.7', '10.244.1.8'] },
        { addresses: ['10.244.2.9'] },
        { conditions: { ready: false } },
      ],
    }),
    text: '10.244.0.5,10.244.1.7,10.244.1.8 + 1 more...',
  },
  {
    type: 'endpointslices',
    col: 'endpoints',
    name: 'exactly three addresses',
    resource: res({
      endpoints: [{ addresses: ['10.0.0.1', '10.0.0.2', '10.0.0.3'] }],
    }),
    text: '10.0.0.1,10.0.0.2,10.0.0.3',
  },
  {
    type: 'endpointslices',
    col: 'endpoints',
    name: 'no endpoints',
    resource: res({ endpoints: [] }),
    text: MISSING_TEXT,
  },
  {
    type: 'endpointslices',
    col: 'service-name',
    name: 'the service-name label',
    resource: res({}, { labels: { 'kubernetes.io/service-name': 'kube-dns' } }),
    text: 'kube-dns',
  },
  {
    type: 'endpointslices',
    col: 'service-name',
    name: 'no labels',
    resource: res(),
    text: MISSING_TEXT,
  },
  // CronJobs
  {
    type: 'cronjobs',
    col: 'suspend',
    name: 'suspended',
    resource: res({ spec: { suspend: true } }),
    text: 'True',
  },
  {
    type: 'cronjobs',
    col: 'suspend',
    name: 'explicitly running',
    resource: res({ spec: { suspend: false } }),
    text: 'False',
  },
  {
    type: 'cronjobs',
    col: 'suspend',
    name: 'absent means False',
    resource: res({ spec: { schedule: '*/5 * * * *' } }),
    text: 'False',
  },
  {
    type: 'cronjobs',
    col: 'active',
    name: 'running jobs',
    resource: res({
      status: {
        active: [
          { kind: 'Job', name: 'a' },
          { kind: 'Job', name: 'b' },
        ],
      },
    }),
    text: '2',
  },
  {
    type: 'cronjobs',
    col: 'active',
    name: 'absent means 0',
    resource: res({ status: {} }),
    text: '0',
  },
  // PersistentVolumes
  {
    type: 'persistentvolume',
    col: 'reason',
    name: 'status.reason',
    resource: res({
      status: { phase: 'Failed', reason: 'VolumeFailedRecycle' },
    }),
    text: 'VolumeFailedRecycle',
  },
  {
    type: 'persistentvolume',
    col: 'reason',
    name: 'empty reason',
    resource: res({ status: { phase: 'Bound', reason: '' } }),
    text: MISSING_TEXT,
  },
  // IngressClasses
  {
    type: 'ingressclass',
    col: 'controller',
    name: 'spec.controller',
    resource: res({ spec: { controller: 'k8s.io/ingress-nginx' } }),
    text: 'k8s.io/ingress-nginx',
  },
  {
    type: 'ingressclass',
    col: 'parameters',
    name: 'kind.apiGroup/name',
    resource: res({
      spec: {
        parameters: {
          apiGroup: 'k8s.example.com',
          kind: 'IngressParameters',
          name: 'external-lb',
          scope: 'Cluster',
        },
      },
    }),
    text: 'IngressParameters.k8s.example.com/external-lb',
  },
  {
    type: 'ingressclass',
    col: 'parameters',
    name: 'core kind without apiGroup',
    resource: res({
      spec: { parameters: { kind: 'ConfigMap', name: 'nginx' } },
    }),
    text: 'ConfigMap/nginx',
  },
  {
    type: 'ingressclass',
    col: 'parameters',
    name: 'no parameters',
    resource: res({ spec: { controller: 'x' } }),
    text: MISSING_TEXT,
  },
  // NetworkPolicies
  {
    type: 'networkpolicy',
    col: 'pod-selector',
    name: 'empty selector selects all pods',
    resource: res({ spec: { podSelector: {}, policyTypes: ['Ingress'] } }),
    text: '<none>',
  },
  {
    type: 'networkpolicy',
    col: 'pod-selector',
    name: 'labels and expressions sorted by key',
    resource: res({
      spec: {
        podSelector: {
          matchLabels: { role: 'db' },
          matchExpressions: [
            { key: 'zone', operator: 'NotIn', values: ['b', 'a'] },
            { key: 'env', operator: 'In', values: ['prod', 'dev'] },
            { key: 'legacy', operator: 'DoesNotExist' },
            { key: 'canary', operator: 'Exists' },
            { key: 'bogus', operator: 'Sometimes' },
            { operator: 'Exists' },
          ],
        },
      },
    }),
    text: 'canary,env in (dev,prod),!legacy,role=db,zone notin (a,b)',
  },
  {
    type: 'networkpolicy',
    col: 'pod-selector',
    name: 'a label and an expression on the same key',
    resource: res({
      spec: {
        podSelector: {
          matchLabels: { app: 'web' },
          matchExpressions: [{ key: 'app', operator: 'Exists' }],
        },
      },
    }),
    text: 'app=web,app',
  },
  {
    type: 'networkpolicy',
    col: 'pod-selector',
    name: 'no spec',
    resource: res(),
    text: MISSING_TEXT,
  },
  {
    type: 'networkpolicy',
    col: 'policy-types',
    name: 'joined, skipping junk',
    resource: res({ spec: { policyTypes: ['Ingress', 3, '', 'Egress'] } }),
    text: 'Ingress,Egress',
  },
  {
    type: 'networkpolicy',
    col: 'policy-types',
    name: 'none',
    resource: res({ spec: {} }),
    text: MISSING_TEXT,
  },
  // ServiceAccounts
  {
    type: 'serviceaccounts',
    col: 'secrets',
    name: 'listed secrets',
    resource: res({ secrets: [{ name: 'default-token-abcde' }] }),
    text: '1',
  },
  {
    type: 'serviceaccounts',
    col: 'secrets',
    name: 'absent means 0',
    resource: res(),
    text: '0',
  },
  // VolumeSnapshots
  {
    type: 'volumesnapshot',
    col: 'ready-to-use',
    name: 'ready',
    resource: res({ status: { readyToUse: true } }),
    text: 'True',
  },
  {
    type: 'volumesnapshot',
    col: 'ready-to-use',
    name: 'not ready',
    resource: res({ status: { readyToUse: false } }),
    text: 'False',
  },
  {
    type: 'volumesnapshot',
    col: 'ready-to-use',
    name: 'no status yet',
    resource: res(),
    text: MISSING_TEXT,
  },
  {
    type: 'volumesnapshot',
    col: 'source',
    name: 'from a claim',
    resource: res({
      spec: { source: { persistentVolumeClaimName: 'data-pvc' } },
    }),
    text: 'data-pvc',
  },
  {
    type: 'volumesnapshot',
    col: 'source',
    name: 'pre-provisioned content',
    resource: res({
      spec: { source: { volumeSnapshotContentName: 'snapcontent-1' } },
    }),
    text: 'snapcontent-1',
  },
  {
    type: 'volumesnapshot',
    col: 'source',
    name: 'no source',
    resource: res({ spec: {} }),
    text: MISSING_TEXT,
  },
  {
    type: 'volumesnapshot',
    col: 'snapshot-class',
    name: 'spec.volumeSnapshotClassName',
    resource: res({
      spec: { volumeSnapshotClassName: 'csi-hostpath-snapclass' },
    }),
    text: 'csi-hostpath-snapclass',
  },
  {
    type: 'volumesnapshot',
    col: 'size',
    name: 'restore size as given',
    resource: res({ status: { restoreSize: '1Gi' } }),
    text: '1Gi',
  },
  {
    type: 'volumesnapshot',
    col: 'size',
    name: 'no size yet',
    resource: res({ status: {} }),
    text: MISSING_TEXT,
  },
  // VolumeSnapshotClasses
  {
    type: 'volumesnapshotclass',
    col: 'driver',
    name: 'top-level driver',
    resource: res({ driver: 'hostpath.csi.k8s.io' }),
    text: 'hostpath.csi.k8s.io',
  },
  {
    type: 'volumesnapshotclass',
    col: 'deletion-policy',
    name: 'top-level deletionPolicy',
    resource: res({ deletionPolicy: 'Delete' }),
    text: 'Delete',
  },
  // PodDisruptionBudgets
  {
    type: 'poddisruptionbudget',
    col: 'min-available',
    name: 'a count',
    resource: res({ spec: { minAvailable: 2 } }),
    text: '2',
  },
  {
    type: 'poddisruptionbudget',
    col: 'min-available',
    name: 'unset when maxUnavailable is used',
    resource: res({ spec: { maxUnavailable: 1 } }),
    text: MISSING_TEXT,
  },
  {
    type: 'poddisruptionbudget',
    col: 'max-unavailable',
    name: 'a percentage',
    resource: res({ spec: { maxUnavailable: '25%' } }),
    text: '25%',
  },
  {
    type: 'poddisruptionbudget',
    col: 'allowed-disruptions',
    name: 'zero is a value',
    resource: res({ status: { disruptionsAllowed: 0, currentHealthy: 1 } }),
    text: '0',
  },
  {
    type: 'poddisruptionbudget',
    col: 'allowed-disruptions',
    name: 'no status yet',
    resource: res(),
    text: MISSING_TEXT,
  },
  // PriorityClasses
  {
    type: 'priorityclass',
    col: 'value',
    name: 'top-level value',
    resource: res({ value: 2000001000 }),
    text: '2000001000',
  },
  {
    type: 'priorityclass',
    col: 'global-default',
    name: 'the default class',
    resource: res({ globalDefault: true }),
    text: 'True',
  },
  {
    type: 'priorityclass',
    col: 'global-default',
    name: 'absent means False',
    resource: res({ value: 1000 }),
    text: 'False',
  },
  {
    type: 'priorityclass',
    col: 'preemption-policy',
    name: 'top-level preemptionPolicy',
    resource: res({ preemptionPolicy: 'PreemptLowerPriority' }),
    text: 'PreemptLowerPriority',
  },
  // RuntimeClasses
  {
    type: 'runtimeclass',
    col: 'handler',
    name: 'top-level handler',
    resource: res({ handler: 'runc' }),
    text: 'runc',
  },
  // Leases
  {
    type: 'lease',
    col: 'holder',
    name: 'spec.holderIdentity',
    resource: res({ spec: { holderIdentity: 'kind-control-plane_1f2e' } }),
    text: 'kind-control-plane_1f2e',
  },
  {
    type: 'lease',
    col: 'duration',
    name: 'seconds',
    resource: res({ spec: { leaseDurationSeconds: 15 } }),
    text: '15s',
  },
  {
    type: 'lease',
    col: 'duration',
    name: 'no duration',
    resource: res({ spec: {} }),
    text: MISSING_TEXT,
  },
  // Webhook configurations
  {
    type: 'mutatingwebhookconfiguration',
    col: 'webhooks',
    name: 'two webhooks',
    resource: res({
      webhooks: [{ name: 'a.example.com' }, { name: 'b.example.com' }],
    }),
    text: '2',
  },
  {
    type: 'validatingwebhookconfiguration',
    col: 'webhooks',
    name: 'absent means 0',
    resource: res(),
    text: '0',
  },
  // APIServices
  {
    type: 'apiservice',
    col: 'service',
    name: 'namespace/name',
    resource: res({
      spec: {
        service: {
          namespace: 'kube-system',
          name: 'metrics-server',
          port: 443,
        },
      },
    }),
    text: 'kube-system/metrics-server',
  },
  {
    type: 'apiservice',
    col: 'service',
    name: 'served by the API server',
    resource: res({ spec: { group: 'apps', version: 'v1' } }),
    text: 'Local',
  },
  {
    type: 'apiservice',
    col: 'available',
    name: 'available',
    resource: res({
      status: {
        conditions: [{ type: 'Available', status: 'True', reason: 'Passed' }],
      },
    }),
    text: 'True',
  },
  {
    type: 'apiservice',
    col: 'available',
    name: 'unavailable with a reason',
    resource: res({
      status: {
        conditions: [
          { type: 'Other', status: 'True' },
          { type: 'Available', status: 'False', reason: 'MissingEndpoints' },
        ],
      },
    }),
    text: 'False (MissingEndpoints)',
  },
  {
    type: 'apiservice',
    col: 'available',
    name: 'unavailable without a reason',
    resource: res({
      status: { conditions: [{ type: 'Available', status: 'False' }] },
    }),
    text: 'False',
  },
  {
    type: 'apiservice',
    col: 'available',
    name: 'a condition without status',
    resource: res({ status: { conditions: [{ type: 'Available' }] } }),
    text: 'Unknown',
  },
  {
    type: 'apiservice',
    col: 'available',
    name: 'no conditions',
    resource: res({ status: {} }),
    text: MISSING_TEXT,
  },
  // Endpoints
  {
    type: 'endpoints',
    col: 'endpoints',
    name: 'every port of every address, cut after three',
    resource: res({
      subsets: [
        {
          addresses: [{ ip: '10.244.0.2' }, { ip: '10.244.0.3' }],
          ports: [
            { name: 'dns', port: 53, protocol: 'UDP' },
            { name: 'metrics', port: 9153, protocol: 'TCP' },
          ],
        },
      ],
    }),
    text: '10.244.0.2:53,10.244.0.3:53,10.244.0.2:9153 + 1 more...',
  },
  {
    type: 'endpoints',
    col: 'endpoints',
    name: 'a headless subset without ports, an IPv6 one',
    resource: res({
      subsets: [
        { addresses: [{ ip: '10.0.0.5' }, { hostname: 'no-ip' }] },
        {
          addresses: [{ ip: 'fd00::1' }],
          ports: [{ port: 443 }, { name: 'x' }],
        },
      ],
    }),
    text: '10.0.0.5,[fd00::1]:443',
  },
  {
    type: 'endpoints',
    col: 'endpoints',
    name: 'only not-ready addresses',
    resource: res({
      subsets: [
        { notReadyAddresses: [{ ip: '10.0.0.9' }], ports: [{ port: 80 }] },
      ],
    }),
    text: '<none>',
  },
  {
    type: 'endpoints',
    col: 'endpoints',
    name: 'no subsets',
    resource: res(),
    text: '<none>',
  },
  // Events
  {
    type: 'events',
    col: 'last-seen',
    name: 'lastTimestamp first',
    resource: res({
      lastTimestamp: '2026-10-31T10:00:00Z',
      eventTime: '2026-10-30T10:00:00.000000Z',
    }),
    text: local('2026-10-31T10:00:00Z'),
  },
  {
    type: 'events',
    col: 'last-seen',
    name: 'then the series',
    resource: res({
      lastTimestamp: null,
      series: { count: 4, lastObservedTime: '2026-10-31T11:00:00.000000Z' },
      eventTime: '2026-10-31T09:00:00.000000Z',
    }),
    text: local('2026-10-31T11:00:00.000000Z'),
  },
  {
    type: 'events',
    col: 'last-seen',
    name: 'then eventTime',
    resource: res({ eventTime: '2026-10-31T12:00:00.000000Z' }),
    text: local('2026-10-31T12:00:00.000000Z'),
  },
  {
    type: 'events',
    col: 'last-seen',
    name: 'then the creation time',
    resource: res({ type: 'Normal' }),
    text: local(CREATED),
  },
  {
    type: 'events',
    col: 'last-seen',
    name: 'no time at all',
    resource: res({}, { creationTimestamp: undefined }),
    text: MISSING_TEXT,
  },
  {
    type: 'events',
    col: 'type',
    name: 'top-level type',
    resource: res({ type: 'Warning' }),
    text: 'Warning',
  },
  {
    type: 'events',
    col: 'reason',
    name: 'top-level reason',
    resource: res({ reason: 'BackOff' }),
    text: 'BackOff',
  },
  {
    type: 'events',
    col: 'message',
    name: 'top-level message',
    resource: res({ message: 'Back-off restarting failed container' }),
    text: 'Back-off restarting failed container',
  },
  {
    type: 'events',
    col: 'message',
    name: 'the events.k8s.io note',
    resource: res({ note: 'Scaled up replica set web-7d4 to 3' }),
    text: 'Scaled up replica set web-7d4 to 3',
  },
  {
    type: 'events',
    col: 'object',
    name: 'involvedObject with the kind lowercased',
    resource: res({
      involvedObject: { kind: 'Pod', name: 'coredns-5d78c9869d-x2x7v' },
    }),
    text: 'pod/coredns-5d78c9869d-x2x7v',
  },
  {
    type: 'events',
    col: 'object',
    name: 'regarding (events.k8s.io)',
    resource: res({ regarding: { kind: 'Deployment', name: 'web' } }),
    text: 'deployment/web',
  },
  {
    type: 'events',
    col: 'object',
    name: 'a kind without name',
    resource: res({ involvedObject: { kind: 'Node' } }),
    text: 'node',
  },
  {
    type: 'events',
    col: 'object',
    name: 'no object',
    resource: res(),
    text: MISSING_TEXT,
  },
  // ControllerRevisions
  {
    type: 'controllerrevisions',
    col: 'controller',
    name: 'the controlling owner with its group',
    resource: res(
      {},
      {
        ownerReferences: [
          { apiVersion: 'v1', kind: 'Pod', name: 'other' },
          {
            apiVersion: 'apps/v1',
            kind: 'DaemonSet',
            name: 'kube-proxy',
            controller: true,
          },
        ],
      }
    ),
    text: 'daemonset.apps/kube-proxy',
  },
  {
    type: 'controllerrevisions',
    col: 'controller',
    name: 'a core-group owner',
    resource: owner({
      apiVersion: 'v1',
      kind: 'ReplicationController',
      name: 'rc',
      controller: true,
    }),
    text: 'replicationcontroller/rc',
  },
  {
    type: 'controllerrevisions',
    col: 'controller',
    name: 'an owner reference without apiVersion or kind',
    resource: owner({ name: 'orphan', controller: true }),
    text: 'orphan',
  },
  {
    type: 'controllerrevisions',
    col: 'controller',
    name: 'no controlling owner',
    resource: owner({ apiVersion: 'apps/v1', kind: 'StatefulSet', name: 's' }),
    text: MISSING_TEXT,
  },
  {
    type: 'controllerrevisions',
    col: 'revision',
    name: 'top-level revision',
    resource: res({ revision: 3 }),
    text: '3',
  },
  // CertificateSigningRequests
  {
    type: 'certificatesigningrequest',
    col: 'requestor',
    name: 'spec.username',
    resource: res({ spec: { username: 'system:node:worker-1' } }),
    text: 'system:node:worker-1',
  },
  {
    type: 'certificatesigningrequest',
    col: 'signer-name',
    name: 'spec.signerName',
    resource: res({
      spec: { signerName: 'kubernetes.io/kube-apiserver-client-kubelet' },
    }),
    text: 'kubernetes.io/kube-apiserver-client-kubelet',
  },
  {
    type: 'certificatesigningrequest',
    col: 'condition',
    name: 'no conditions',
    resource: res({ status: {} }),
    text: 'Pending',
  },
  {
    type: 'certificatesigningrequest',
    col: 'condition',
    name: 'approved and issued',
    resource: res({
      status: {
        conditions: [{ type: 'Approved', status: 'True' }],
        certificate: 'LS0tLS1CRUdJTi...',
      },
    }),
    text: 'Approved,Issued',
  },
  {
    type: 'certificatesigningrequest',
    col: 'condition',
    name: 'approved but failed',
    resource: res({
      status: {
        conditions: [
          { type: 'Approved', status: 'True' },
          { type: 'Failed', status: 'True' },
        ],
      },
    }),
    text: 'Approved,Failed',
  },
  {
    type: 'certificatesigningrequest',
    col: 'condition',
    name: 'denied wins',
    resource: res({
      status: {
        conditions: [
          { type: 'Approved', status: 'True' },
          { type: 'Denied', status: 'True' },
        ],
      },
    }),
    text: 'Denied',
  },
  // FlowSchemas and PriorityLevelConfigurations
  {
    type: 'flowschema',
    col: 'priority-level',
    name: 'spec.priorityLevelConfiguration.name',
    resource: res({
      spec: { priorityLevelConfiguration: { name: 'workload-high' } },
    }),
    text: 'workload-high',
  },
  {
    type: 'flowschema',
    col: 'strategy',
    name: 'spec.distinguisherMethod.type',
    resource: res({ spec: { distinguisherMethod: { type: 'ByUser' } } }),
    text: 'ByUser',
  },
  {
    type: 'flowschema',
    col: 'strategy',
    name: 'no distinguisher',
    resource: res({ spec: { matchingPrecedence: 1000 } }),
    text: MISSING_TEXT,
  },
  {
    type: 'prioritylevelconfiguration',
    col: 'type',
    name: 'spec.type',
    resource: res({ spec: { type: 'Limited' } }),
    text: 'Limited',
  },
  // Role bindings
  {
    type: 'rolebinding',
    col: 'binding-role',
    name: 'Kind/name',
    resource: res({
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: 'view',
      },
    }),
    text: 'ClusterRole/view',
  },
  {
    type: 'clusterrolebinding',
    col: 'binding-role',
    name: 'Kind/name',
    resource: res({ roleRef: { kind: 'ClusterRole', name: 'cluster-admin' } }),
    text: 'ClusterRole/cluster-admin',
  },
  {
    type: 'clusterrolebinding',
    col: 'binding-role',
    name: 'no roleRef',
    resource: res(),
    text: MISSING_TEXT,
  },
  // Pod Security Admission (namespaces)
  {
    type: 'podsecurityadmission',
    col: 'enforce',
    name: 'level and version',
    resource: psa({
      'pod-security.kubernetes.io/enforce': 'restricted',
      'pod-security.kubernetes.io/enforce-version': 'v1.30',
    }),
    text: 'restricted (v1.30)',
  },
  {
    type: 'podsecurityadmission',
    col: 'audit',
    name: 'level only',
    resource: psa({ 'pod-security.kubernetes.io/audit': 'baseline' }),
    text: 'baseline',
  },
  {
    type: 'podsecurityadmission',
    col: 'warn',
    name: 'a version without level',
    resource: psa({ 'pod-security.kubernetes.io/warn-version': 'latest' }),
    text: MISSING_TEXT,
  },
  {
    type: 'podsecurityadmission',
    col: 'warn',
    name: 'an unlabelled namespace',
    resource: res(),
    text: MISSING_TEXT,
  },
];

describe('field columns', () => {
  it.each(CASES)('$type/$col: $name', ({ type, col, resource, text }) => {
    expect(textOf(type, col, resource)).toBe(text);
  });

  it('never shows an object or a list', () => {
    for (const { type, col, resource } of CASES) {
      expect(textOf(type, col, resource)).not.toMatch(/\[object |undefined/);
    }
  });

  describe('sort values', () => {
    it('are numbers for counts and durations', () => {
      expect(
        valueOf(
          'lease',
          'duration',
          res({ spec: { leaseDurationSeconds: 15 } })
        )
      ).toBe(15);
      expect(valueOf('cronjobs', 'active', res())).toBe(0);
    });

    it('are the whole list for a cut list', () => {
      const slice = res({
        endpoints: [
          { addresses: ['10.0.0.1', '10.0.0.2', '10.0.0.3', '10.0.0.4'] },
        ],
      });
      expect(valueOf('endpointslices', 'endpoints', slice)).toBe(
        '10.0.0.1,10.0.0.2,10.0.0.3,10.0.0.4'
      );
      expect(valueOf('endpoints', 'endpoints', res())).toBeUndefined();
    });

    it('are the ISO time for the last-seen column', () => {
      expect(
        valueOf(
          'events',
          'last-seen',
          res({ lastTimestamp: '2026-10-31T10:00:00Z' })
        )
      ).toBe('2026-10-31T10:00:00Z');
    });

    it('are int or string for disruption budgets', () => {
      expect(
        valueOf(
          'poddisruptionbudget',
          'min-available',
          res({ spec: { minAvailable: 1 } })
        )
      ).toBe(1);
      expect(
        valueOf(
          'poddisruptionbudget',
          'max-unavailable',
          res({ spec: { maxUnavailable: '50%' } })
        )
      ).toBe('50%');
    });

    it.each([
      ['1Gi', 2 ** 30],
      ['500Mi', 500 * 2 ** 20],
      ['1.5G', 1.5e9],
      ['2', 2],
      ['100m', 0.1],
    ])('reads the snapshot size %s as %d', (restoreSize, bytes) => {
      expect(
        valueOf('volumesnapshot', 'size', res({ status: { restoreSize } }))
      ).toBeCloseTo(bytes);
    });

    it('reads a numeric snapshot size as is and an odd one as missing', () => {
      const numeric = res({ status: { restoreSize: 1024 } });
      expect(valueOf('volumesnapshot', 'size', numeric)).toBe(1024);
      expect(textOf('volumesnapshot', 'size', numeric)).toBe('1024');
      const odd = res({ status: { restoreSize: '3 bananas' } });
      expect(valueOf('volumesnapshot', 'size', odd)).toBeUndefined();
      expect(textOf('volumesnapshot', 'size', odd)).toBe('3 bananas');
      const unknownSuffix = res({ status: { restoreSize: '3Zi' } });
      expect(valueOf('volumesnapshot', 'size', unknownSuffix)).toBeUndefined();
    });
  });

  describe('getFieldColumn', () => {
    it('knows nothing about a kind without field columns', () => {
      expect(getFieldColumn('pods', 'restarts')).toBeUndefined();
    });

    it('knows nothing about other columns of a kind', () => {
      expect(getFieldColumn('events', 'namespace')).toBeUndefined();
    });

    it('does not mistake inherited object keys for columns', () => {
      expect(getFieldColumn('events', 'constructor')).toBeUndefined();
      expect(getFieldColumn('events', 'toString')).toBeUndefined();
    });
  });

  describe('formatFieldValue', () => {
    it.each([
      [undefined, MISSING_TEXT],
      ['', MISSING_TEXT],
      [true, 'True'],
      [false, 'False'],
      [0, '0'],
      ['Running', 'Running'],
    ])('formats %j as %s', (value, text) => {
      expect(formatFieldValue(value)).toBe(text);
    });
  });

  describe('toFieldValue', () => {
    it('keeps primitives', () => {
      expect(toFieldValue('a')).toBe('a');
      expect(toFieldValue(0)).toBe(0);
      expect(toFieldValue(false)).toBe(false);
    });

    it('drops objects, lists, null and empty text', () => {
      expect(toFieldValue({ a: 1 })).toBeUndefined();
      expect(toFieldValue([1])).toBeUndefined();
      expect(toFieldValue(null)).toBeUndefined();
      expect(toFieldValue('')).toBeUndefined();
    });
  });

  describe('truncatedList', () => {
    it('keeps up to three items', () => {
      expect(truncatedList([])).toBe('');
      expect(truncatedList(['a', 'b', 'c'])).toBe('a,b,c');
    });

    it('counts the rest', () => {
      expect(truncatedList(['a', 'b', 'c', 'd', 'e'])).toBe(
        'a,b,c + 2 more...'
      );
    });
  });

  describe('compareFieldValues', () => {
    it('orders numbers numerically', () => {
      expect(compareFieldValues(2, 10)).toBeLessThan(0);
      expect(compareFieldValues(10, 2)).toBeGreaterThan(0);
      expect(compareFieldValues(3, 3)).toBe(0);
    });

    it('puts false before true', () => {
      expect(compareFieldValues(false, true)).toBeLessThan(0);
      expect(compareFieldValues(true, false)).toBeGreaterThan(0);
    });

    it('orders text naturally', () => {
      expect(compareFieldValues('pod-2', 'pod-10')).toBeLessThan(0);
      expect(compareFieldValues('b', 'a')).toBeGreaterThan(0);
      expect(compareFieldValues('a', 'a')).toBe(0);
    });

    it('puts missing values last', () => {
      expect(compareFieldValues(undefined, 'a')).toBeGreaterThan(0);
      expect(compareFieldValues(0, undefined)).toBeLessThan(0);
      expect(compareFieldValues(undefined, undefined)).toBe(0);
    });

    it('orders mixed kinds booleans, numbers, text', () => {
      expect(compareFieldValues(1, '50%')).toBeLessThan(0);
      expect(compareFieldValues('50%', 1)).toBeGreaterThan(0);
      expect(compareFieldValues(true, 0)).toBeLessThan(0);
    });
  });
});
