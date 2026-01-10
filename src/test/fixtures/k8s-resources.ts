import type {
  Pod,
  Deployment,
  PersistentVolumeClaim,
  Node,
  Service,
  HorizontalPodAutoscaler,
  StatefulSet,
  Ingress,
  Secret,
  ConfigMap,
  PersistentVolume,
  DaemonSet,
  ReplicaSet,
  Job,
  CronJob,
  GenericResource,
} from '../../types/k8s-types';

export const mockNamespaces = ['all', 'default', 'kube-system'];

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

export const mockPVC: PersistentVolumeClaim[] = [
  {
    metadata: {
      name: 'pvc-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T10:00:00Z',
      annotations: { 'volume.kubernetes.io/selected-node': 'node-PVC-TARGET' },
    },
    status: {
      phase: 'Bound',
      capacity: { storage: '5Gi' },
    },
    spec: {
      volumeName: 'pv-1',
      accessModes: ['ReadWriteOnce'],
      storageClassName: 'gp2',
      volumeMode: 'Block',
    },
  },
  {
    metadata: {
      name: 'pvc-2',
      namespace: 'default',
      creationTimestamp: '2023-01-01T10:00:00Z',
    },
    status: {
      phase: 'Pending',
      capacity: { storage: '10Gi' },
    },
    spec: {
      volumeName: 'pv-2',
      accessModes: ['ReadWriteMany'],
      storageClassName: 'standard',
      volumeMode: 'Filesystem',
    },
  },
];

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

export const mockServices: Service[] = [
  {
    metadata: {
      name: 'svc-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T10:00:00Z',
    },
    spec: {
      type: 'LoadBalancer',
      clusterIP: '10.96.0.1',
      ports: [{ port: 80, protocol: 'TCP' }],
      selector: { app: 'nginx' },
    },
    status: {
      loadBalancer: { ingress: [{ ip: '35.1.2.3' }] },
    },
  },
  {
    metadata: {
      name: 'svc-2',
      namespace: 'default',
      creationTimestamp: '2023-01-01T10:00:00Z',
    },
    spec: {
      type: 'ClusterIP',
      clusterIP: '10.96.0.2',
      ports: [{ port: 443, protocol: 'TCP' }],
    },
  },
];

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

export const mockIngress: Ingress[] = [
  {
    metadata: {
      name: 'ing-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T10:00:00Z',
      annotations: { 'kubernetes.io/ingress.class': 'nginx' },
    },
    spec: {
      rules: [
        {
          host: 'example.com',
          http: {
            paths: [
              {
                path: '/',
                pathType: 'Prefix',
                backend: { service: { name: 'svc-1', port: { number: 80 } } },
              },
            ],
          },
        },
      ],
      tls: [{ hosts: ['example.com'], secretName: 'tls-secret' }],
    },
    status: {
      loadBalancer: { ingress: [{ hostname: 'lb.com' }] },
    },
  },
];

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

// Additional resources from ClusterDetails.test.tsx

export const mockPV: PersistentVolume[] = [
  {
    metadata: { name: 'pv-1', creationTimestamp: '2024-01-01T00:00:00Z' },
    spec: {
      capacity: { storage: '10Gi' },
      accessModes: ['ReadWriteOnce'],
      persistentVolumeReclaimPolicy: 'Retain',
      storageClassName: 'gp2',
      volumeMode: 'Filesystem',
    },
    status: { phase: 'Bound' },
  },
];
export const mockSC: any[] = [
  {
    metadata: { name: 'sc-1', creationTimestamp: '2024-01-01T00:00:00Z' },
    provisioner: 'ebs.csi.aws.com',
    reclaimPolicy: 'Delete',
    volumeBindingMode: 'Immediate',
    allowVolumeExpansion: true,
  },
];
export const mockVS: any[] = [
  {
    metadata: {
      name: 'vs-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    spec: {
      volumeSnapshotClassName: 'vsc-1',
      source: { persistentVolumeClaimName: 'pvc-1' },
    },
    status: { readyToUse: true, restoreSize: '5Gi' },
  },
];
export const mockVSC: any[] = [
  {
    metadata: { name: 'vsc-1', creationTimestamp: '2024-01-01T00:00:00Z' },
    driver: 'ebs.csi.aws.com',
    deletionPolicy: 'Delete',
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
    status: { replicas: 3, readyReplicas: 3, availableReplicas: 3 },
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
export const mockRoles: any[] = [
  {
    metadata: {
      name: 'role-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
  },
];
export const mockRoleBindings: any[] = [
  {
    metadata: {
      name: 'rb-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    roleRef: { name: 'role-1', kind: 'Role' },
  },
];
export const mockServiceAccounts: any[] = [
  {
    metadata: {
      name: 'sa-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    secrets: [{ name: 'sa-token' }],
  },
];
export const mockNetworkPolicies: GenericResource[] = [
  {
    metadata: {
      name: 'np-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    spec: { podSelector: {}, policyTypes: ['Ingress'] },
  },
];
export const mockEndpoints: any[] = [
  {
    metadata: {
      name: 'ep-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    subsets: [{ addresses: [{ ip: '1.2.3.4' }], ports: [{ port: 80 }] }],
  },
];
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

export const mockPod = mockPods[0];
export const mockDeployment = mockDeployments[0];
export const mockService = mockServices[0];
export const mockNode = mockNodes[0];
export const mockSecret = mockSecrets[0];
export const mockConfigMap = mockConfigMaps[0];
export const mockStatefulSet = mockStatefulSets[0];
export const mockDaemonSet = mockDaemonSets[0];
export const mockJob = mockJobs[0];
export const mockCronJob = mockCronJobs[0];
export const mockHpa = mockHPA[0];
