/**
 * Miscellaneous cell renderers for other resource types
 */

import React from 'react'
import { TextCell } from '../ResourceCells'
import type { K8sResource } from '../../../types/k8s-types'
import type { ResourceType } from '../../../lib/resource-definitions'

interface CellProps {
    resource: K8sResource
    style: React.CSSProperties
}

interface CellPropsWithType extends CellProps {
    resourceType: ResourceType
}

/**
 * HPA Reference Cell
 */
export const HPAReferenceCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = resource.spec as Record<string, unknown> | undefined
    const ref = spec?.scaleTargetRef as Record<string, unknown> | undefined
    return <TextCell content={ref ? `${ref.kind}/${ref.name}` : '-'} style={style} />
}

/**
 * HPA Targets Cell
 */
export const HPATargetsCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = resource.spec as Record<string, unknown> | undefined
    const status = resource.status as Record<string, unknown> | undefined
    const metrics = status?.currentMetrics as Record<string, unknown>[] | undefined
    const specMetrics = spec?.metrics as Record<string, unknown>[] | undefined
    const firstSpecMetric = specMetrics?.[0] as Record<string, unknown> | undefined
    const target = (((firstSpecMetric?.resource as Record<string, unknown>)?.target as Record<string, unknown>)?.averageUtilization) as number | undefined
    const firstMetric = metrics?.[0] as Record<string, unknown> | undefined
    const current = (((firstMetric?.resource as Record<string, unknown>)?.current as Record<string, unknown>)?.averageUtilization) as number | undefined

    if (current === undefined || target === undefined) return <TextCell content="<unknown>" style={style} />
    return <TextCell content={`${current}% / ${target}%`} style={style} />
}

/**
 * Secret/ServiceAccount Type/Data cells
 */
export const SecretTypeCell: React.FC<CellProps> = ({ resource, style }) => {
    const r = resource as Record<string, unknown>
    return <TextCell content={(r.type as string) || '-'} style={style} />
}

/**
 * CronJob specific cells
 */
export const CronJobScheduleCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = resource.spec as Record<string, unknown> | undefined
    return <TextCell content={(spec?.schedule as string) || '-'} style={style} />
}

export const CronJobLastScheduleCell: React.FC<CellProps> = ({ resource, style }) => {
    const status = resource.status as Record<string, unknown> | undefined
    return <TextCell content={(status?.lastScheduleTime as string) || 'Never'} style={style} />
}

/**
 * Deployment/StatefulSet Replicas logic handled by common WorkloadCells,
 * but specific ones like MinPods/MaxPods for HPA:
 */
export const MinPodsCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = resource.spec as Record<string, unknown> | undefined
    return <TextCell content={String(spec?.minReplicas || '-')} style={style} />
}

export const MaxPodsCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = resource.spec as Record<string, unknown> | undefined
    return <TextCell content={String(spec?.maxReplicas || '-')} style={style} />
}

export const ReplicasCell: React.FC<CellProps> = ({ resource, style }) => {
    const status = resource.status as Record<string, unknown> | undefined
    return <TextCell content={String(status?.currentReplicas || '-')} style={style} />
}
