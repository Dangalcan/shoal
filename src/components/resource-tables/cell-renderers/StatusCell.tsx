/**
 * Status cell: the text `kubectl get` prints, with a badge for how it reads
 */

import React from 'react';
import type { K8sResource } from '../../../types/k8s-types';
import { StatusBadge } from '../../ui/StatusBadge';
import {
  getResourceStatus,
  getStatusVariant,
} from '../../../lib/resources/resource-status';
import type { ResourceType } from '../../../lib/resources/resource-definitions';

interface StatusCellProps {
  resource: K8sResource;
  resourceType: ResourceType;
  style: React.CSSProperties;
}

/**
 * Renders the status cell with appropriate badge
 */
export const StatusCell: React.FC<StatusCellProps> = ({
  resource,
  resourceType,
  style,
}) => {
  const status = getResourceStatus(resource, resourceType);

  return (
    <td key="status" className="table-cell" style={style}>
      <StatusBadge
        label={status}
        variant={getStatusVariant(status, resourceType)}
      />
    </td>
  );
};
