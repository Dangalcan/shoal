/**
 * Pod-specific cell renderers
 */

import React from 'react'
import type { K8sResource } from '../../../types/k8s-types'
import { TextCell } from '../ResourceCells'

interface CellProps {
    resource: K8sResource
    style: React.CSSProperties
}

/**
 * Renders the restart count for a pod
 */
export const RestartsCell: React.FC<CellProps> = ({ resource, style }) => {
    const status = (resource as Record<string, unknown>).status as Record<string, unknown> || {}
    const restarts = (status.containerStatuses as Record<string, unknown>[] | undefined)?.reduce(
        (acc: number, c) => acc + (c.restartCount as number),
        0
    ) || 0
    return <TextCell key="restarts" content={String(restarts)} style={style} />
}

/**
 * Renders the pod IP address
 */
export const PodIPCell: React.FC<CellProps> = ({ resource, style }) => {
    const status = (resource as Record<string, unknown>).status || {}
    return <TextCell key="ip" variant="mono" content={status.podIP || '<none>'} style={style} />
}

/**
 * Renders the node name where the pod is running
 */
export const NodeNameCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as Record<string, unknown>).spec || {}
    return <TextCell key="node" content={spec.nodeName || '<none>'} style={style} />
}

/**
 * Renders the nominated node name
 */
export const NominatedNodeCell: React.FC<CellProps> = ({ resource, style }) => {
    const status = (resource as Record<string, unknown>).status || {}
    return <TextCell key="nominated-node" content={status.nominatedNodeName || '<none>'} style={style} />
}

/**
 * Renders readiness gates
 */
export const ReadinessGatesCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as Record<string, unknown>).spec as Record<string, unknown> || {}
    const gates = (spec.readinessGates as Record<string, unknown>[] | undefined)?.map((g) => g.conditionType).join(', ') || '<none>'
    return <TextCell key="readiness-gates" content={gates} style={style} />
}
