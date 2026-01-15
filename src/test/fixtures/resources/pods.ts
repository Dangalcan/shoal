import type { Pod } from '../../../types/k8s-types';

export const mockPods: Pod[] = [
  {
    metadata: {
      name: 'pod-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T10:00:00Z',
      uid: 'pod-1-uid',
    },
    status: {
      phase: 'Running',
      podIP: '10.0.0.1',
      containerStatuses: [
        { name: 'c1', ready: true, restartCount: 5, image: 'img1' },
      ],
      nominatedNodeName: 'node-SPECIFIC',
    },
    spec: {
      nodeName: 'node-A',
      containers: [{ name: 'c1', image: 'img1' }],
      readinessGates: [{ conditionType: 'Ready' }],
    },
  },
  {
    metadata: {
      name: 'pod-2',
      namespace: 'default',
      creationTimestamp: '2023-01-01T10:00:00Z',
      uid: 'pod-2-uid',
    },
    status: {
      phase: 'Pending',
      podIP: '10.0.0.2',
      containerStatuses: [
        { name: 'd1', ready: false, restartCount: 10, image: 'img2' },
      ],
    },
    spec: {
      nodeName: 'node-B',
      containers: [{ name: 'd1', image: 'img2' }],
    },
  },
];

export const mockPod = mockPods[0];
