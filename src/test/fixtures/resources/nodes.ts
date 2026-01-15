import type { Node } from '../../../types/k8s-types';

export const mockNodes: Node[] = [
  {
    metadata: {
      name: 'node-A',
      creationTimestamp: '2024-01-01T10:00:00Z',
      labels: { 'node-role.kubernetes.io/master': '' },
    },
    status: {
      conditions: [{ type: 'Ready', status: 'True' }],
      nodeInfo: {
        kubeletVersion: 'v1.28.0',
        osImage: 'Fedora',
        kernelVersion: '6.1',
        containerRuntimeVersion: 'docker',
      },
      addresses: [
        { type: 'InternalIP', address: '172.16.0.1' },
        { type: 'ExternalIP', address: '1.2.3.4' },
      ],
    },
  },
  {
    metadata: {
      name: 'node-B',
      creationTimestamp: '2023-01-01T10:00:00Z',
      labels: { 'node-role.kubernetes.io/worker': '' },
    },
    status: {
      conditions: [{ type: 'Ready', status: 'False' }],
      nodeInfo: {
        kubeletVersion: 'v1.27.0',
        osImage: 'Ubuntu',
        kernelVersion: '5.15',
        containerRuntimeVersion: 'containerd',
      },
      addresses: [
        { type: 'InternalIP', address: '172.16.0.2' },
        { type: 'ExternalIP', address: '5.6.7.8' },
      ],
    },
  },
];

export const mockNode = mockNodes[0];
