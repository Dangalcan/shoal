/**
 * Type guard functions for Kubernetes resources
 * These functions help TypeScript narrow types at runtime
 */

import type {
  K8sResource,
  Pod,
  Job,
  PersistentVolumeClaim,
  Node,
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
 * True for plain objects (not null, not arrays), so unknown API fields can be
 * read as `Record<string, unknown>` without a cast to `any`.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads a string field from an object of unknown shape (some list payloads
 * flatten fields such as `type` or `ports` to the top level).
 */
export function stringField(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const field = value[key];
  return typeof field === 'string' ? field : undefined;
}
