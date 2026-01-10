/**
 * Node-specific cell renderers
 */

import React from 'react'
import type { Node } from '../../../types/k8s-types'
import { isNode } from '../../../lib/type-guards'
import { TextCell } from '../ResourceCells'

interface CellProps {
    resource: any
    style: React.CSSProperties
}

/**
 * RolesCell renders the roles of a node based on its labels
 */
export const RolesCell: React.FC<CellProps> = ({ resource, style }) => {
    if (!isNode(resource)) return <TextCell content="-" style={style} />
    
    const roles = Object.keys(resource.metadata.labels || {})
        .filter(label => label.startsWith('node-role.kubernetes.io/'))
        .map(label => label.replace('node-role.kubernetes.io/', ''))
    
    return <TextCell content={roles.join(', ') || '<none>'} style={style} />
}

/**
 * VersionCell renders the kubelet version of a node
 */
export const VersionCell: React.FC<CellProps> = ({ resource, style }) => {
    if (!isNode(resource)) return <TextCell content="-" style={style} />
    return <TextCell content={resource.status?.nodeInfo?.kubeletVersion || '-'} style={style} />
}

/**
 * NodeInternalIPCell renders the internal IP address of a node
 */
export const NodeInternalIPCell: React.FC<CellProps> = ({ resource, style }) => {
    if (!isNode(resource)) return <TextCell content="-" style={style} />
    const addr = resource.status?.addresses?.find(a => a.type === 'InternalIP')?.address
    return <TextCell content={addr || '-'} style={style} />
}

/**
 * NodeExternalIPCell renders the external IP address of a node
 */
export const NodeExternalIPCell: React.FC<CellProps> = ({ resource, style }) => {
    if (!isNode(resource)) return <TextCell content="-" style={style} />
    const addr = resource.status?.addresses?.find(a => a.type === 'ExternalIP')?.address
    return <TextCell content={addr || '-'} style={style} />
}

/**
 * OSImageCell renders the OS image of a node
 */
export const OSImageCell: React.FC<CellProps> = ({ resource, style }) => {
    if (!isNode(resource)) return <TextCell content="-" style={style} />
    return <TextCell content={resource.status?.nodeInfo?.osImage || '-'} style={style} />
}

/**
 * KernelVersionCell renders the kernel version of a node
 */
export const KernelVersionCell: React.FC<CellProps> = ({ resource, style }) => {
    if (!isNode(resource)) return <TextCell content="-" style={style} />
    return <TextCell content={resource.status?.nodeInfo?.kernelVersion || '-'} style={style} />
}

/**
 * ContainerRuntimeCell renders the container runtime version of a node
 */
export const ContainerRuntimeCell: React.FC<CellProps> = ({ resource, style }) => {
    if (!isNode(resource)) return <TextCell content="-" style={style} />
    return <TextCell content={resource.status?.nodeInfo?.containerRuntimeVersion || '-'} style={style} />
}
