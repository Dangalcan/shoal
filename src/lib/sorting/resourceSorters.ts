/**
 * resourceSorters.ts
 *
 * Contains specialized sorting functions for various Kubernetes resources.
 * Uses the strategies defined in sortStrategies.ts but applies them to specific
 * resource properties (metadata, status, spec).
 *
 * Each sorter is a reusable function compatible with Array.prototype.sort().
 */

import type {
  AnyK8sResource,
  Pod,
  Node,
  Deployment,
  StatefulSet,
  DaemonSet,
  ReplicaSet,
} from '../../types/k8s-types';
import type { ResourceType } from '../resource-definitions';
import type { SorterFunction } from './types';
import { sortByString, sortByNumber, sortByDate } from './sortStrategies';
import { isPod } from '../type-guards';

/**
 * Helper to safely extract the phase or condition status from a resource.
 * @param r - The Kubernetes resource
 * @returns The phase string or first condition type, or empty string.
 */
const getPhase = (r: AnyK8sResource): string => {
  if (r.status && typeof r.status === 'object') {
    if ('phase' in r.status)
      return (r.status as Record<string, unknown>).phase || '';
    if (
      'conditions' in r.status &&
      Array.isArray((r.status as Record<string, unknown>).conditions) &&
      (r.status as Record<string, unknown>).conditions.length > 0
    ) {
      return (r.status as Record<string, unknown>).conditions[0].type || '';
    }
  }
  return '';
};

// Common Metadata Sorters
/** Sorts resources alphabetically by name */
export const sortByName = sortByString((r) => r.metadata.name);
/** Sorts resources alphabetically by namespace */
export const sortByNamespace = sortByString((r) => r.metadata.namespace || '');
/** Sorts resources by creation timestamp (newest first or oldest first depends on direction) */
export const sortByAge = sortByDate((r) => r.metadata.creationTimestamp);

// Resource Specific Sorters

// Status Sorter
/**
 * Returns a sorter function appropriate for the given resource type's status.
 * Optimized for Pods (phase), but falls back to generic condition checks for other types.
 *
 * @param resourceType - The type of resource to get the sorter for
 * @returns A SorterFunction
 */
export const getStatusSorter = (resourceType: ResourceType): SorterFunction => {
  return sortByString((r) => {
    if (isPod(r)) return r.status?.phase || '';
    return getPhase(r as AnyK8sResource);
  });
};

// Pod Specific
export const sortByRestarts = sortByNumber((r) => {
  if (isPod(r)) {
    return (
      r.status?.containerStatuses?.reduce(
        (acc: number, c) => acc + c.restartCount,
        0
      ) || 0
    );
  }
  return 0;
});

export const sortByIP = sortByString((r) => {
  if ('status' in r && 'podIP' in (r.status as Record<string, unknown>))
    return (r as Pod).status?.podIP || '';
  return '';
});

export const sortByNode = sortByString((r) => {
  if ('spec' in r && 'nodeName' in (r as Pod).spec!)
    return (r as Pod).spec?.nodeName || '';
  return '';
});

// Workload Specific
export const sortByReplicas = sortByNumber((r) => {
  const res = r as Deployment | StatefulSet | ReplicaSet;
  return res.status?.replicas || 0;
});

export const sortByReadyReplicas = sortByNumber((r) => {
  const res = r as Deployment | StatefulSet | ReplicaSet | DaemonSet;
  // Narrowing for DaemonSet which doesn't have readyReplicas
  if ('numberReady' in (res.status || {}))
    return (res as DaemonSet).status?.numberReady || 0;
  // Others have readyReplicas
  return (
    ((res.status as Record<string, unknown>)?.readyReplicas as number) || 0
  );
});

export const sortByUpdatedReplicas = sortByNumber((r) => {
  const res = r as Deployment | StatefulSet | DaemonSet;
  if ('updatedNumberScheduled' in (res.status || {}))
    return (res as DaemonSet).status?.updatedNumberScheduled || 0;
  return (
    ((res.status as Record<string, unknown>)?.updatedReplicas as number) || 0
  );
});

export const sortByAvailableReplicas = sortByNumber((r) => {
  const res = r as Deployment | ReplicaSet | DaemonSet;
  if ('numberAvailable' in (res.status || {}))
    return (res as DaemonSet).status?.numberAvailable || 0;
  return (
    ((res.status as Record<string, unknown>)?.availableReplicas as number) || 0
  );
});

// Data (ConfigMaps/Secrets)
export const sortByDataCount = sortByNumber((r) => {
  const rr = r as Record<string, unknown>;
  const data =
    (rr.data as Record<string, unknown>) ||
    (rr.binaryData as Record<string, unknown>) ||
    {};
  return Object.keys(data).length;
});

// Node Specific
export const sortByNodeRoles = sortByString((r) =>
  Object.keys(r.metadata?.labels || {})
    .filter((l) => l.startsWith('node-role.kubernetes.io/'))
    .join(', ')
);

export const sortByKubeletVersion = sortByString((r) => {
  return (r as Node).status?.nodeInfo?.kubeletVersion || '';
});

export const sortByOSImage = sortByString((r) => {
  return (r as Node).status?.nodeInfo?.osImage || '';
});

export const sortByKernelVersion = sortByString((r) => {
  return (r as Node).status?.nodeInfo?.kernelVersion || '';
});

export const sortByContainerRuntime = sortByString((r) => {
  return (r as Node).status?.nodeInfo?.containerRuntimeVersion || '';
});

// Network IPs
export const sortByInternalIP = sortByString((r) => {
  const node = r as Node;
  return (
    node.status?.addresses?.find((addr) => addr.type === 'InternalIP')
      ?.address || ''
  );
});

export const sortByExternalIP = sortByString((r) => {
  const node = r as Node;
  return (
    node.status?.addresses?.find((addr) => addr.type === 'ExternalIP')
      ?.address || ''
  );
});

// Containers & Images
export const sortByContainers = sortByString((r) => {
  const spec = (r as Record<string, unknown>).spec as
    | Record<string, unknown>
    | undefined;
  const podSpec =
    ((spec?.template as Record<string, unknown> | undefined)?.spec as
      | Record<string, unknown>
      | undefined) || spec;
  const containers = podSpec?.containers as
    | Record<string, unknown>[]
    | undefined;
  if (Array.isArray(containers)) {
    return containers.map((c) => c.name).join(', ');
  }
  return '';
});

export const sortByImages = sortByString((r) => {
  const spec = (r as Record<string, unknown>).spec as
    | Record<string, unknown>
    | undefined;
  const podSpec =
    ((spec?.template as Record<string, unknown> | undefined)?.spec as
      | Record<string, unknown>
      | undefined) || spec;
  const containers = podSpec?.containers as
    | Record<string, unknown>[]
    | undefined;
  if (Array.isArray(containers)) {
    return containers.map((c) => c.image as string).join(', ');
  }
  return '';
});

// Selector
export const sortBySelector = sortByString((r) => {
  const spec = (r as Record<string, unknown>).spec as
    | Record<string, unknown>
    | undefined;
  const selectorObj = spec?.selector as Record<string, unknown> | undefined;
  const selector =
    (selectorObj?.matchLabels as Record<string, unknown>) || selectorObj || {};
  return Object.keys(selector).length > 0 ? JSON.stringify(selector) : '';
});
