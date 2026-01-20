import type {
  Service,
  Ingress,
  GenericResource,
} from '../../../types/k8s-types';

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

export const mockService = mockServices[0]!;
