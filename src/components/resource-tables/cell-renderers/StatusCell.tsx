/**
 * Status cell renderer with type-safe status badge logic
 */

import React from 'react'
import type { K8sResource, Pod, PersistentVolumeClaim, Node, Job } from '../../../types/k8s-types'
import { isPod, isPersistentVolumeClaim, isNode, isJob } from '../../../lib/type-guards'
import { StatusBadge } from '../ResourceCells'
import type { ResourceType } from '../../../lib/resource-definitions'

interface StatusCellProps {
    resource: K8sResource
    resourceType: ResourceType
    style: React.CSSProperties
}

/**
 * Determines the status value and type for a resource
 */
function getResourceStatus(resource: K8sResource, resourceType: ResourceType): {
    status: string
    type: 'pods' | 'pvc' | 'nodes' | 'other'
} {
    // Use type guards for type-safe access
    if (isPod(resource)) {
        return {
            status: resource.status?.phase || 'Unknown',
            type: 'pods'
        }
    }

    if (isPersistentVolumeClaim(resource)) {
        return {
            status: resource.status?.phase || 'Unknown',
            type: 'pvc'
        }
    }

    if (isNode(resource)) {
        const ready = resource.status?.conditions?.find(c => c.type === 'Ready')?.status === 'True'
        return {
            status: ready ? 'Ready' : 'NotReady',
            type: 'nodes'
        }
    }

    if (isJob(resource)) {
        const status = resource.status
        if (status?.succeeded && status.succeeded >= 1) {
            return { status: 'Complete', type: 'other' }
        }
        if (status?.failed && status.failed >= 1) {
            return { status: 'Failed', type: 'other' }
        }
        return { status: 'Running', type: 'other' }
    }

    return { status: 'Unknown', type: 'other' }
}

/**
 * Renders the status cell with appropriate badge
 */
export const StatusCell: React.FC<StatusCellProps> = ({ resource, resourceType, style }) => {
    const { status, type } = getResourceStatus(resource, resourceType)

    return (
        <td key="status" className="table-cell" style={style}>
            <StatusBadge status={status} type={type} />
        </td>
    )
}
