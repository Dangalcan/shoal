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
  ReplicaSet,
} from '../../types/k8s-types';
import type { ResourceType } from '../resources/resource-definitions';
import type { SorterFunction } from './types';
import { sortByString, sortByNumber, sortByDate } from './sortStrategies';
import { isPod, isRecord } from '../type-guards';

/**
 * Helper to safely extract the phase or condition status from a resource.
 * @param r - The Kubernetes resource
 * @returns The phase string or first condition type, or empty string.
 */
const getPhase = (r: AnyK8sResource): string => {
  const status: unknown = r.status;
  if (!isRecord(status)) return '';
  if ('phase' in status) {
    return typeof status.phase === 'string' ? status.phase : '';
  }
  const [first] = Array.isArray(status.conditions) ? status.conditions : [];
  return isRecord(first) && typeof first.type === 'string' ? first.type : '';
};

/**
 * Reads a numeric status counter (`readyReplicas`, `numberReady`, ...) from a
 * resource whose exact kind is not known; missing or non-numeric is 0.
 */
const statusCounter = (status: unknown, key: string): number => {
  if (!isRecord(status)) return 0;
  const value = status[key];
  return typeof value === 'number' ? value : 0;
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
export const getStatusSorter = (
  _resourceType: ResourceType
): SorterFunction => {
  return sortByString((r) => {
    if (isPod(r)) return r.status?.phase || '';
    return getPhase(r as AnyK8sResource);
  });
};

// Pod Specific
// A container status without restartCount counts as 0, as RestartsCell
// shows it; adding undefined would turn the whole sum into NaN.
export const sortByRestarts = sortByNumber((r) => {
  if (isPod(r)) {
    return (
      r.status?.containerStatuses?.reduce(
        (acc: number, c) => acc + (c.restartCount ?? 0),
        0
      ) ?? 0
    );
  }
  return 0;
});

export const sortByIP = sortByString((r) => {
  if (isRecord(r.status) && 'podIP' in r.status)
    return (r as Pod).status?.podIP || '';
  return '';
});

// `spec` may be absent or null on a partial object; `in` would throw on null.
export const sortByNode = sortByString((r) => {
  const spec: unknown = r.spec;
  return isRecord(spec) && typeof spec.nodeName === 'string'
    ? spec.nodeName
    : '';
});

// Workload Specific
export const sortByReplicas = sortByNumber((r) => {
  const res = r as Deployment | StatefulSet | ReplicaSet;
  return res.status?.replicas || 0;
});

// DaemonSets count pods with `number*`, the other workloads with `*Replicas`.
export const sortByReadyReplicas = sortByNumber((r) =>
  isRecord(r.status) && 'numberReady' in r.status
    ? statusCounter(r.status, 'numberReady')
    : statusCounter(r.status, 'readyReplicas')
);

export const sortByUpdatedReplicas = sortByNumber((r) =>
  isRecord(r.status) && 'updatedNumberScheduled' in r.status
    ? statusCounter(r.status, 'updatedNumberScheduled')
    : statusCounter(r.status, 'updatedReplicas')
);

export const sortByAvailableReplicas = sortByNumber((r) =>
  isRecord(r.status) && 'numberAvailable' in r.status
    ? statusCounter(r.status, 'numberAvailable')
    : statusCounter(r.status, 'availableReplicas')
);

// Data (ConfigMaps/Secrets)
export const sortByDataCount = sortByNumber((r) => {
  const rr = r as unknown as Record<string, unknown>;
  const data =
    (rr.data as unknown as Record<string, unknown>) ||
    (rr.binaryData as unknown as Record<string, unknown>) ||
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
  const spec = (r as unknown as Record<string, unknown>).spec as
    Record<string, unknown> | undefined;
  const podSpec =
    ((spec?.template as unknown as Record<string, unknown> | undefined)
      ?.spec as Record<string, unknown> | undefined) || spec;
  const containers = podSpec?.containers as
    Record<string, unknown>[] | undefined;
  if (Array.isArray(containers)) {
    return containers.map((c) => c.name).join(', ');
  }
  return '';
});

export const sortByImages = sortByString((r) => {
  const spec = (r as unknown as Record<string, unknown>).spec as
    Record<string, unknown> | undefined;
  const podSpec =
    ((spec?.template as unknown as Record<string, unknown> | undefined)
      ?.spec as Record<string, unknown> | undefined) || spec;
  const containers = podSpec?.containers as
    Record<string, unknown>[] | undefined;
  if (Array.isArray(containers)) {
    return containers.map((c) => c.image as string).join(', ');
  }
  return '';
});

// Selector
export const sortBySelector = sortByString((r) => {
  const spec = (r as unknown as Record<string, unknown>).spec as
    Record<string, unknown> | undefined;
  const selectorObj = spec?.selector as unknown as
    Record<string, unknown> | undefined;
  const selector =
    (selectorObj?.matchLabels as unknown as Record<string, unknown>) ||
    selectorObj ||
    {};
  return Object.keys(selector).length > 0 ? JSON.stringify(selector) : '';
});
