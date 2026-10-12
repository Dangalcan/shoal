/**
 * Pod-specific cell renderers
 */

import React from 'react';
import type { Pod } from '../../../types/k8s-types';
import { TextCell } from '../ResourceCells';

interface CellProps {
  resource: Pod;
  style: React.CSSProperties;
}

/**
 * Renders the restart count for a pod
 */
export const RestartsCell: React.FC<CellProps> = ({ resource, style }) => {
  const restarts =
    resource.status?.containerStatuses?.reduce(
      (acc: number, c: any) => acc + (c.restartCount || 0),
      0
    ) || 0;
  return <TextCell key="restarts" content={String(restarts)} style={style} />;
};

/**
 * Renders the pod IP address
 */
export const PodIPCell: React.FC<CellProps> = ({ resource, style }) => {
  return (
    <TextCell
      key="ip"
      variant="mono"
      content={resource.status?.podIP || '<none>'}
      style={style}
    />
  );
};

/**
 * Renders the node name where the pod is running
 */
export const NodeNameCell: React.FC<CellProps> = ({ resource, style }) => {
  return (
    <TextCell
      key="node"
      content={resource.spec?.nodeName || '<none>'}
      style={style}
    />
  );
};

/**
 * Renders the nominated node name
 */
export const NominatedNodeCell: React.FC<CellProps> = ({ resource, style }) => {
  return (
    <TextCell
      key="nominated-node"
      content={resource.status?.nominatedNodeName || '<none>'}
      style={style}
    />
  );
};

/**
 * Renders readiness gates
 */
export const ReadinessGatesCell: React.FC<CellProps> = ({
  resource,
  style,
}) => {
  const gates =
    resource.spec?.readinessGates
      ?.map((g: any) => g.conditionType)
      .join(', ') || '<none>';
  return <TextCell key="readiness-gates" content={gates} style={style} />;
};
