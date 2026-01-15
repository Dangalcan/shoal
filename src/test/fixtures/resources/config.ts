import type { Secret, ConfigMap } from '../../../types/k8s-types';

export const mockSecrets: Secret[] = [
  {
    metadata: {
      name: 'sec-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T10:00:00Z',
    },
    type: 'Opaque',
    data: { key1: 'dmFsMQ==', key2: 'dmFsMg==' }, // Base64 for val1, val2
  },
  {
    metadata: {
      name: 'sec-2',
      namespace: 'default',
      creationTimestamp: '2023-01-01T10:00:00Z',
    },
    type: 'kubernetes.io/service-account-token',
    data: { token: 'YWJj' }, // Base64 for abc
  },
];

export const mockConfigMaps: ConfigMap[] = [
  {
    metadata: {
      name: 'cm-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T10:00:00Z',
    },
    data: { 'config.json': '{}' },
  },
];

export const mockSecret = mockSecrets[0];
export const mockConfigMap = mockConfigMaps[0];
