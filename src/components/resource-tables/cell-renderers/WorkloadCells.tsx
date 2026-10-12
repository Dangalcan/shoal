/**
 * Workload-specific cell renderers (Deployments, ReplicaSets, DaemonSets, StatefulSets, Jobs)
 */

import React from 'react';
import type { K8sResource } from '../../../types/k8s-types';
import type { ResourceType } from '../../../lib/resources/resource-definitions';
import { TextCell } from '../ResourceCells';

interface CellProps {
  resource: K8sResource;
  resourceType: ResourceType;
  style: React.CSSProperties;
}

/** Status counters of Deployments, ReplicaSets, StatefulSets, DaemonSets and Jobs. */
interface WorkloadStatus {
  replicas?: number;
  readyReplicas?: number;
  availableReplicas?: number;
  updatedReplicas?: number;
  numberReady?: number;
  numberAvailable?: number;
  desiredNumberScheduled?: number;
  currentNumberScheduled?: number;
  updatedNumberScheduled?: number;
  succeeded?: number;
  startTime?: string;
  completionTime?: string;
}

interface WorkloadSpec {
  replicas?: number;
  completions?: number;
}

const workloadStatus = (resource: K8sResource): WorkloadStatus =>
  (resource.status ?? {}) as WorkloadStatus;
const workloadSpec = (resource: K8sResource): WorkloadSpec =>
  (resource.spec ?? {}) as WorkloadSpec;

/**
 * Renders the ready replicas count
 */
export const ReadyCell: React.FC<CellProps> = ({
  resource,
  resourceType,
  style,
}) => {
  const status = workloadStatus(resource);
  let readyContent: string | number = 0;

  if (resourceType === 'replicasets') {
    readyContent = status.readyReplicas || 0;
  } else if (resourceType === 'daemonsets') {
    readyContent = status.numberReady || 0;
  } else {
    readyContent = `${status.readyReplicas || 0} / ${status.replicas || 0}`;
  }

  return <TextCell key="ready" content={String(readyContent)} style={style} />;
};

/**
 * Renders the desired replicas/pods count
 */
export const DesiredCell: React.FC<CellProps> = ({
  resource,
  resourceType,
  style,
}) => {
  const desired =
    resourceType === 'daemonsets'
      ? workloadStatus(resource).desiredNumberScheduled || 0
      : workloadSpec(resource).replicas || 0;
  return <TextCell key="desired" content={String(desired)} style={style} />;
};

/**
 * Renders the current replicas/pods count
 */
export const CurrentCell: React.FC<CellProps> = ({
  resource,
  resourceType,
  style,
}) => {
  const status = workloadStatus(resource);
  const current =
    resourceType === 'daemonsets'
      ? status.currentNumberScheduled || 0
      : status.replicas || 0;
  return <TextCell key="current" content={String(current)} style={style} />;
};

/**
 * Renders the updated replicas count
 */
export const UpdatedCell: React.FC<CellProps> = ({
  resource,
  resourceType,
  style,
}) => {
  const status = workloadStatus(resource);
  const updated =
    resourceType === 'daemonsets'
      ? status.updatedNumberScheduled || 0
      : status.updatedReplicas || 0;
  return <TextCell key="updated" content={String(updated)} style={style} />;
};

/**
 * Renders the available replicas count
 */
export const AvailableCell: React.FC<CellProps> = ({
  resource,
  resourceType,
  style,
}) => {
  const status = workloadStatus(resource);
  const available =
    resourceType === 'daemonsets'
      ? status.numberAvailable || 0
      : status.availableReplicas || 0;
  return <TextCell key="available" content={String(available)} style={style} />;
};

/**
 * Renders job completions
 */
export const CompletionsCell: React.FC<Omit<CellProps, 'resourceType'>> = ({
  resource,
  style,
}) => {
  const status = workloadStatus(resource);
  const spec = workloadSpec(resource);
  const content = `${status.succeeded || 0} / ${spec.completions || 1}`;
  return <TextCell key="completions" content={content} style={style} />;
};

/**
 * Renders job duration
 */
export const DurationCell: React.FC<Omit<CellProps, 'resourceType'>> = ({
  resource,
  style,
}) => {
  const status = workloadStatus(resource);
  // A running Job shows the time elapsed so far, so the clock is read during
  // render on purpose; the table re-renders on every refresh interval.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  let duration = '-';

  if (status.startTime) {
    const start = new Date(status.startTime).getTime();
    const end = status.completionTime
      ? new Date(status.completionTime).getTime()
      : now;
    const diff = Math.floor((end - start) / 1000);
    duration = `${diff}s`;
  }

  return <TextCell key="duration" content={duration} style={style} />;
};
