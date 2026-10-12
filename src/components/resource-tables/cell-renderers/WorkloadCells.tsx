/**
 * Workload-specific cell renderers (Deployments, ReplicaSets, DaemonSets, StatefulSets, Jobs)
 */

import React from 'react';
import type { ResourceType } from '../../../lib/resources/resource-definitions';
import { TextCell } from '../ResourceCells';

interface CellProps {
  resource: any;
  resourceType: ResourceType;
  style: React.CSSProperties;
}

/**
 * Renders the ready replicas count
 */
export const ReadyCell: React.FC<CellProps> = ({
  resource,
  resourceType,
  style,
}) => {
  const status = resource.status || {};
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
  const spec = resource.spec || {};
  const status = resource.status || {};
  const desired =
    resourceType === 'daemonsets'
      ? status.desiredNumberScheduled || 0
      : spec.replicas || 0;
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
  const status = resource.status || {};
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
  const status = resource.status || {};
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
  const status = resource.status || {};
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
  const status = resource.status || {};
  const spec = resource.spec || {};
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
  const status = resource.status || {};
  let duration = '-';

  if (status.startTime) {
    const start = new Date(status.startTime).getTime();
    const end = status.completionTime
      ? new Date(status.completionTime).getTime()
      : Date.now();
    const diff = Math.floor((end - start) / 1000);
    duration = `${diff}s`;
  }

  return <TextCell key="duration" content={duration} style={style} />;
};
