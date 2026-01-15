import type { GenericResource } from '../../../types/k8s-types';

export const mockPodDisruptionBudgets: GenericResource[] = [
  {
    metadata: {
      name: 'pdb-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    spec: { minAvailable: 1 },
    status: { disruptionsAllowed: 1 },
  },
];

export const mockResourceQuotas: GenericResource[] = [
  {
    metadata: {
      name: 'rq-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    status: { hard: { pods: '10' }, used: { pods: '1' } },
  },
];

export const mockCRDs: any[] = [
  {
    metadata: {
      name: 'crds.example.com',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    spec: { scope: 'Namespaced', group: 'example.com' },
  },
];

export const mockWebhooks: any[] = [
  {
    metadata: { name: 'webhook-1', creationTimestamp: '2024-01-01T00:00:00Z' },
    webhooks: [{ name: 'check.example.com' }],
  },
];

export const mockAPIServices: any[] = [
  {
    metadata: {
      name: 'v1.example.com',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    spec: { service: { name: 'svc' } },
    status: { conditions: [{ type: 'Available', status: 'True' }] },
  },
];

export const mockLeases: GenericResource[] = [
  {
    metadata: {
      name: 'lease-1',
      namespace: 'kube-system',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    spec: { holderIdentity: 'node-A', leaseDurationSeconds: 30 },
  },
];

export const mockPriorityClasses: any[] = [
  {
    metadata: {
      name: 'high-priority',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    value: 1000,
    preemptionPolicy: 'PreemptLowerPriority',
  },
];

export const mockCSRs: any[] = [
  {
    metadata: { name: 'csr-1', creationTimestamp: '2024-01-01T00:00:00Z' },
    spec: {
      username: 'admin',
      signerName: 'kubernetes.io/kube-apiserver-client',
    },
    status: { conditions: [{ type: 'Approved' }] },
  },
];
