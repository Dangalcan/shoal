/**
 * Miscellaneous cell renderers for other resource types
 */

import React from 'react'
import { TextCell } from '../ResourceCells'
import type { ResourceType } from '../../../lib/resource-definitions'

interface CellProps {
    resource: any
    style: React.CSSProperties
}

interface CellPropsWithType extends CellProps {
    resourceType: ResourceType
}

/**
 * HPA Reference Cell
 */
export const HPAReferenceCell: React.FC<CellProps> = ({ resource, style }) => {
    const ref = resource.spec?.scaleTargetRef
    return <TextCell content={ref ? `${ref.kind}/${ref.name}` : '-'} style={style} />
}

/**
 * HPA Targets Cell
 */
export const HPATargetsCell: React.FC<CellProps> = ({ resource, style }) => {
    const metrics = resource.status?.currentMetrics
    const target = resource.spec?.metrics?.[0]?.resource?.target?.averageUtilization
    const current = metrics?.[0]?.resource?.current?.averageUtilization
    
    if (current === undefined || target === undefined) return <TextCell content="<unknown>" style={style} />
    return <TextCell content={`${current}% / ${target}%`} style={style} />
}

/**
 * Secret/ServiceAccount Type/Data cells
 */
export const SecretTypeCell: React.FC<CellProps> = ({ resource, style }) => {
    return <TextCell content={resource.type || '-'} style={style} />
}

/**
 * CronJob specific cells
 */
export const CronJobScheduleCell: React.FC<CellProps> = ({ resource, style }) => {
    return <TextCell content={resource.spec?.schedule || '-'} style={style} />
}

export const CronJobLastScheduleCell: React.FC<CellProps> = ({ resource, style }) => {
    return <TextCell content={resource.status?.lastScheduleTime || 'Never'} style={style} />
}

/**
 * Deployment/StatefulSet Replicas logic handled by common WorkloadCells,
 * but specific ones like MinPods/MaxPods for HPA:
 */
export const MinPodsCell: React.FC<CellProps> = ({ resource, style }) => {
    return <TextCell content={String(resource.spec?.minReplicas || '-')} style={style} />
}

export const MaxPodsCell: React.FC<CellProps> = ({ resource, style }) => {
    return <TextCell content={String(resource.spec?.maxReplicas || '-')} style={style} />
}

export const ReplicasCell: React.FC<CellProps> = ({ resource, style }) => {
    return <TextCell content={String(resource.status?.currentReplicas || '-')} style={style} />
}
