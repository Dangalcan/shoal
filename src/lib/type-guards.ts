/**
 * Type guard functions for Kubernetes resources
 * These functions help TypeScript narrow types at runtime
 */

import type {
  K8sResource,
  Pod,
  Deployment,
  Service,
  StatefulSet,
  DaemonSet,
  ReplicaSet,
  Job,
  CronJob,
  PersistentVolume,
  PersistentVolumeClaim,
  Node,
  ConfigMap,
  Secret,
  Ingress,
  HorizontalPodAutoscaler,
} from '../types/k8s-types';

/**
 * Check if a resource is a Pod
 */
export function isPod(resource: K8sResource): resource is Pod {
  return (
    resource.spec !== undefined &&
    'containers' in (resource.spec as Record<string, unknown>) &&
    Array.isArray((resource.spec as Record<string, unknown>).containers)
  );
}

/**
 * Check if a resource is a Deployment
 */
export function isDeployment(resource: K8sResource): resource is Deployment {
  return (
    resource.spec !== undefined &&
    'selector' in (resource.spec as Record<string, unknown>) &&
    'template' in (resource.spec as Record<string, unknown>)
  );
}

/**
 * Check if a resource is a Service
 */
export function isService(resource: K8sResource): resource is Service {
  return (
    resource.spec !== undefined &&
    'ports' in (resource.spec as Record<string, unknown>) &&
    Array.isArray((resource.spec as Record<string, unknown>).ports)
  );
}

/**
 * Check if a resource is a StatefulSet
 */
export function isStatefulSet(resource: K8sResource): resource is StatefulSet {
  return (
    resource.spec !== undefined &&
    'serviceName' in (resource.spec as Record<string, unknown>) &&
    'selector' in (resource.spec as Record<string, unknown>)
  );
}

/**
 * Check if a resource is a DaemonSet
 */
export function isDaemonSet(resource: K8sResource): resource is DaemonSet {
  return (
    resource.spec !== undefined &&
    'selector' in (resource.spec as Record<string, unknown>) &&
    resource.status !== undefined &&
    'desiredNumberScheduled' in (resource.status as Record<string, unknown>)
  );
}

/**
 * Check if a resource is a ReplicaSet
 */
export function isReplicaSet(resource: K8sResource): resource is ReplicaSet {
  return (
    resource.spec !== undefined &&
    'selector' in (resource.spec as Record<string, unknown>) &&
    resource.status !== undefined &&
    'fullyLabeledReplicas' in (resource.status as Record<string, unknown>)
  );
}

/**
 * Check if a resource is a Job
 */
export function isJob(resource: K8sResource): resource is Job {
  return (
    resource.spec !== undefined &&
    'template' in (resource.spec as Record<string, unknown>) &&
    resource.status !== undefined &&
    ('succeeded' in (resource.status as Record<string, unknown>) ||
      'failed' in (resource.status as Record<string, unknown>))
  );
}

/**
 * Check if a resource is a CronJob
 */
export function isCronJob(resource: K8sResource): resource is CronJob {
  return (
    resource.spec !== undefined &&
    'schedule' in (resource.spec as Record<string, unknown>) &&
    'jobTemplate' in (resource.spec as Record<string, unknown>)
  );
}

/**
 * Check if a resource is a PersistentVolume
 */
export function isPersistentVolume(
  resource: K8sResource
): resource is PersistentVolume {
  return (
    resource.spec !== undefined &&
    'capacity' in (resource.spec as Record<string, unknown>) &&
    !resource.metadata.namespace // PVs are cluster-scoped
  );
}

/**
 * Check if a resource is a PersistentVolumeClaim
 */
export function isPersistentVolumeClaim(
  resource: K8sResource
): resource is PersistentVolumeClaim {
  return (
    resource.spec !== undefined &&
    'resources' in (resource.spec as Record<string, unknown>) &&
    resource.metadata.namespace !== undefined // PVCs are namespaced
  );
}

/**
 * Check if a resource is a Node
 */
export function isNode(resource: K8sResource): resource is Node {
  return (
    resource.status !== undefined &&
    'nodeInfo' in (resource.status as Record<string, unknown>) &&
    'addresses' in (resource.status as Record<string, unknown>)
  );
}

/**
 * Check if a resource is a ConfigMap
 */
export function isConfigMap(resource: K8sResource): resource is ConfigMap {
  return 'data' in resource || 'binaryData' in resource;
}

/**
 * Check if a resource is a Secret
 */
export function isSecret(resource: K8sResource): resource is Secret {
  return (
    'type' in resource &&
    typeof (resource as Record<string, unknown>).type === 'string' &&
    ('data' in resource || 'stringData' in resource)
  );
}

/**
 * Check if a resource is an Ingress
 */
export function isIngress(resource: K8sResource): resource is Ingress {
  return (
    resource.spec !== undefined &&
    ('rules' in (resource.spec as Record<string, unknown>) ||
      'defaultBackend' in (resource.spec as Record<string, unknown>))
  );
}

/**
 * Check if a resource is a HorizontalPodAutoscaler
 */
export function isHorizontalPodAutoscaler(
  resource: K8sResource
): resource is HorizontalPodAutoscaler {
  return (
    resource.spec !== undefined &&
    'scaleTargetRef' in (resource.spec as Record<string, unknown>) &&
    'maxReplicas' in (resource.spec as Record<string, unknown>)
  );
}

/**
 * Helper function to safely access nested properties
 */
export function hasNestedProperty(obj: unknown, path: string): boolean {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== 'object' ||
      !(key in (current as Record<string, unknown>))
    ) {
      return false;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current !== undefined;
}
