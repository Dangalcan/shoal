import type {
  HorizontalPodAutoscaler,
  StatefulSet,
  ReplicaSet,
  DaemonSet,
  Job,
  CronJob,
  GenericResource,
} from '../../../types/k8s-types';

export const mockHPA: HorizontalPodAutoscaler[] = [
  {
    metadata: {
      name: 'hpa-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T10:00:00Z',
    },
    spec: {
      scaleTargetRef: { kind: 'Deployment', name: 'dep-1' },
      minReplicas: 1,
      maxReplicas: 10,
      metrics: [
        {
          type: 'Resource',
          resource: {
            name: 'cpu',
            target: { type: 'Utilization', averageUtilization: 80 },
          },
        },
      ],
    },
    status: {
      currentReplicas: 2,
      desiredReplicas: 2,
      currentMetrics: [
        {
          type: 'Resource',
          resource: { name: 'cpu', current: { averageUtilization: 50 } },
        },
      ],
    },
  },
];

export const mockStatefulSets: StatefulSet[] = [
  {
    metadata: {
      name: 'sts-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T10:00:00Z',
    },
    status: {
      readyReplicas: 1,
      replicas: 1,
    },
    spec: {
      serviceName: 'sts-svc',
      replicas: 1,
      selector: { matchLabels: { app: 'sts' } },
      template: {},
    },
  },
];

export const mockReplicaSets: ReplicaSet[] = [
  {
    metadata: {
      name: 'rs-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    spec: { replicas: 3, selector: { matchLabels: {} } },
    status: {
      replicas: 3,
      readyReplicas: 3,
      availableReplicas: 3,
      fullyLabeledReplicas: 3,
    },
  },
];

export const mockDaemonSets: DaemonSet[] = [
  {
    metadata: {
      name: 'ds-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    status: {
      desiredNumberScheduled: 5,
      currentNumberScheduled: 5,
      numberReady: 5,
      updatedNumberScheduled: 5,
    },
    spec: { selector: { matchLabels: {} }, template: {} },
  },
];

export const mockJobs: Job[] = [
  {
    metadata: {
      name: 'job-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    status: { active: 0, succeeded: 1, failed: 0 },
    spec: { completions: 1, selector: { matchLabels: {} }, template: {} },
  },
];

export const mockCronJobs: CronJob[] = [
  {
    metadata: {
      name: 'cj-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    spec: { schedule: '*/5 * * * *', suspend: false, jobTemplate: {} },
    status: { lastScheduleTime: '2024-01-01T10:00:00Z' },
  },
];

export const mockReplicationControllers: GenericResource[] = [
  {
    metadata: {
      name: 'rc-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    spec: { replicas: 2 },
    status: { replicas: 2, readyReplicas: 2 },
  },
];

export const mockStatefulSet = mockStatefulSets[0]!;
export const mockDaemonSet = mockDaemonSets[0]!;
export const mockJob = mockJobs[0]!;
export const mockCronJob = mockCronJobs[0]!;
export const mockHpa = mockHPA[0]!;
