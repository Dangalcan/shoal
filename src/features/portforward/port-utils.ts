import type { K8sResource } from '../../types/k8s-types';

interface ServiceSpecLike {
  ports?: Array<{ port?: number }>;
}

interface PodSpecLike {
  containers?: Array<{ ports?: Array<{ containerPort?: number }> }>;
}

/**
 * Ports declared on the resource, used to prefill the Forward modal.
 * Services expose spec.ports[].port; pods expose
 * spec.containers[].ports[].containerPort. Either may be absent.
 */
export function getForwardablePorts(
  item: K8sResource,
  resourceType: 'pod' | 'service'
): number[] {
  const ports: number[] = [];

  if (resourceType === 'service') {
    const spec = item.spec as ServiceSpecLike | undefined;
    for (const p of spec?.ports ?? []) {
      if (typeof p.port === 'number') ports.push(p.port);
    }
  } else {
    const spec = item.spec as PodSpecLike | undefined;
    for (const container of spec?.containers ?? []) {
      for (const p of container.ports ?? []) {
        if (typeof p.containerPort === 'number') ports.push(p.containerPort);
      }
    }
  }

  return [...new Set(ports)];
}
