import type { Deployment } from '../../../types/k8s-types';

export const mockDeployments: Deployment[] = [
  {
    metadata: {
      name: 'dep-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T10:00:00Z',
    },
    status: {
      readyReplicas: 2,
      replicas: 3,
      updatedReplicas: 2,
      availableReplicas: 1,
    },
    spec: {
      template: {
        spec: {
          containers: [{ name: 'nginx-c', image: 'nginx-i' }],
        },
      },
      selector: { matchLabels: { app: 'nginx' } },
    },
  },
  {
    metadata: {
      name: 'dep-2',
      namespace: 'default',
      creationTimestamp: '2023-01-01T10:00:00Z',
    },
    status: {
      readyReplicas: 0,
      replicas: 1,
      updatedReplicas: 1,
      availableReplicas: 0,
    },
    spec: {
      template: {
        spec: {
          containers: [{ name: 'apache-c', image: 'apache-i' }],
        },
      },
      selector: { matchLabels: { app: 'apache' } },
    },
  },
];

export const mockDeployment = mockDeployments[0];
