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
    const data = (resource as any).data || (resource as any).binaryData || {}
    const dataKeys = Object.keys(data).length
    return <TextCell key="data" content={String(dataKeys)} style={style} />
}

/**
 * Renders selector labels as key=value pairs
 */
export const SelectorCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as any).spec || {}
    const labels = spec.selector?.matchLabels || spec.selector || {}
    const selectorContent = Object.entries(labels)
        .map(([k, v]) => `${k}=${v}`)
        .join(',') || '<none>'
    return <TextCell key="selector" content={selectorContent} style={style} />
}

/**
 * Renders container names from pod spec
 */
export const ContainersCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as any).spec || {}
    const podSpec = spec.template?.spec || spec
    const containers = podSpec?.containers?.map((c: any) => c.name).join(', ') || '<none>'
    return <TextCell key="containers" content={containers} style={style} />
}

/**
 * Renders container images from pod spec
 */
export const ImagesCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as any).spec || {}
    const podSpec = spec.template?.spec || spec
    const images = podSpec?.containers?.map((c: any) => c.image).join(', ') || '<none>'
    return <TextCell key="images" content={images} style={style} />
}
