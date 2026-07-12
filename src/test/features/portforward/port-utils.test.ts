import { describe, it, expect } from 'vitest';
import { getForwardablePorts } from '../../../features/portforward/port-utils';
import type { K8sResource } from '../../../types/k8s-types';

describe('getForwardablePorts', () => {
  it('extracts service ports', () => {
    const svc = {
      metadata: { name: 'svc' },
      spec: { ports: [{ port: 80 }, { port: 443 }, { port: 80 }] },
    } as K8sResource;

    expect(getForwardablePorts(svc, 'service')).toEqual([80, 443]);
  });

  it('extracts container ports from pods across containers', () => {
    const pod = {
      metadata: { name: 'pod' },
      spec: {
        containers: [
          { ports: [{ containerPort: 8080 }] },
          { ports: [{ containerPort: 9090 }, { containerPort: 8080 }] },
          {},
        ],
      },
    } as K8sResource;

    expect(getForwardablePorts(pod, 'pod')).toEqual([8080, 9090]);
  });

  it('returns empty for resources without port declarations', () => {
    const bare = { metadata: { name: 'x' } } as K8sResource;
    expect(getForwardablePorts(bare, 'pod')).toEqual([]);
    expect(getForwardablePorts(bare, 'service')).toEqual([]);
  });
});
