/**
 * Common cell renderer components used across multiple resource types
 */

import React from 'react'
import type { K8sResource } from '../../../types/k8s-types'
import { TextCell } from '../ResourceCells'

interface CellProps {
    resource: K8sResource
    style: React.CSSProperties
}

/**
 * Renders the namespace cell for a resource
 */
export const NamespaceCell: React.FC<CellProps> = ({ resource, style }) => {
    return (
        <td key="namespace" className="table-cell table-cell-namespace" style={style}>
            {resource.metadata.namespace}
        </td>
    )
}

/**
 * Renders the age cell showing when the resource was created
 */
export const AgeCell: React.FC<CellProps> = ({ resource, style }) => {
    const age = new Date(resource.metadata.creationTimestamp).toLocaleString()
    return <TextCell key="age" content={age} style={style} />
}

/**
 * Renders a generic data count cell (for ConfigMaps, Secrets, etc.)
 */
export const DataCountCell: React.FC<CellProps> = ({ resource, style }) => {
    const r = resource as unknown as Record<string, unknown>
    const data = (r.data as unknown as Record<string, unknown>) || (r.binaryData as unknown as Record<string, unknown>) || {}
    const dataKeys = Object.keys(data).length
    return <TextCell key="data" content={String(dataKeys)} style={style} />
}

/**
 * Renders selector labels as key=value pairs
 */
export const SelectorCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as unknown as Record<string, unknown>).spec as unknown as Record<string, unknown> || {}
    const labels = (spec.selector as unknown as Record<string, unknown> | undefined)?.matchLabels || spec.selector || {}
    const selectorContent = Object.entries(labels as unknown as Record<string, unknown>)
        .map(([k, v]) => `${k}=${v}`)
        .join(',') || '<none>'
    return <TextCell key="selector" content={selectorContent} style={style} />
}

/**
 * Renders container names from pod spec
 */
export const ContainersCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as unknown as Record<string, unknown>).spec as unknown as Record<string, unknown> || {}
    const podSpec = (spec.template as unknown as Record<string, unknown>)?.spec as unknown as Record<string, unknown> || spec
    const containers = (podSpec?.containers as unknown as Record<string, unknown>[] | undefined)?.map((c) => c.name).join(', ') || '<none>'
    return <TextCell key="containers" content={containers} style={style} />
}

/**
 * Renders container images from pod spec
 */
export const ImagesCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as unknown as Record<string, unknown>).spec as unknown as Record<string, unknown> || {}
    const podSpec = (spec.template as unknown as Record<string, unknown>)?.spec as unknown as Record<string, unknown> || spec
    const images = (podSpec?.containers as unknown as Record<string, unknown>[] | undefined)?.map((c) => c.image).join(', ') || '<none>'
    return <TextCell key="images" content={images} style={style} />
}
