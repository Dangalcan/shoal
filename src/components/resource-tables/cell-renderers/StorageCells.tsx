/**
 * Storage resource cell renderers (PersistentVolumes, PersistentVolumeClaims, StorageClasses)
 */

import React from 'react'
import type { K8sResource } from '../../../types/k8s-types'
import { TextCell } from '../ResourceCells'

interface CellProps {
    resource: K8sResource
    style: React.CSSProperties
}

/**
 * Renders storage capacity
 */
export const CapacityCell: React.FC<CellProps> = ({ resource, style }) => {
    const status = (resource as Record<string, unknown>).status || {}
    const spec = (resource as Record<string, unknown>).spec || {}
    const capacity = status.capacity?.storage || spec.capacity?.storage || '<none>'
    return <TextCell key="capacity" content={capacity} style={style} />
}

/**
 * Renders access modes
 */
export const AccessModesCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as Record<string, unknown>).spec || {}
    const modes = spec.accessModes?.join(', ') || '<none>'
    return <TextCell key="access-modes" content={modes} style={style} />
}

/**
 * Renders storage class name
 */
export const StorageClassCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as Record<string, unknown>).spec || {}
    return <TextCell key="storageclass" content={spec.storageClassName || '<none>'} style={style} />
}

/**
 * Renders volume mode
 */
export const VolumeModeCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as Record<string, unknown>).spec || {}
    return <TextCell key="volumemode" content={spec.volumeMode || 'Filesystem'} style={style} />
}

/**
 * Renders reclaim policy
 */
export const ReclaimPolicyCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as Record<string, unknown>).spec || {}
    const reclaimPolicy = spec.persistentVolumeReclaimPolicy || (resource as Record<string, unknown>).reclaimPolicy || 'Delete'
    return <TextCell key="reclaim-policy" content={reclaimPolicy} style={style} />
}

/**
 * Renders PV claim reference
 */
export const ClaimCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as Record<string, unknown>).spec || {}
    const claimRef = spec.claimRef
    const claimContent = claimRef ? `${claimRef.namespace}/${claimRef.name}` : '<none>'
    return <TextCell key="claim" variant="mono" content={claimContent} style={style} />
}

/**
 * Renders volume name
 */
export const VolumeCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as Record<string, unknown>).spec || {}
    return <TextCell key="volume" variant="mono" content={spec.volumeName || '<none>'} style={style} />
}

/**
 * Renders storage provisioner
 */
export const ProvisionerCell: React.FC<CellProps> = ({ resource, style }) => {
    const provisioner = (resource as Record<string, unknown>).provisioner || '<none>'
    return <TextCell key="provisioner" content={provisioner} style={style} />
}

/**
 * Renders volume binding mode
 */
export const BindingModeCell: React.FC<CellProps> = ({ resource, style }) => {
    const volumeBindingMode = (resource as Record<string, unknown>).volumeBindingMode || '<none>'
    return <TextCell key="binding-mode" content={volumeBindingMode} style={style} />
}

/**
 * Renders allow volume expansion
 */
export const AllowExpansionCell: React.FC<CellProps> = ({ resource, style }) => {
    const allowExpansion = (resource as Record<string, unknown>).allowVolumeExpansion ?? false
    return <TextCell key="allow-expansion" content={String(allowExpansion)} style={style} />
}

/**
 * Renders PVC selected node (from annotation)
 */
export const PVCSelectedNodeCell: React.FC<CellProps> = ({ resource, style }) => {
    const annotations = resource.metadata?.annotations || {}
    const node = annotations['volume.kubernetes.io/selected-node'] || '<none>'
    return <TextCell key="selected-node" content={node} style={style} />
}

/**
 * Renders VolumeAttributesClass
 */
export const VACCell: React.FC<CellProps> = ({ resource, style }) => {
    const spec = (resource as Record<string, unknown>).spec || {}
    const vac = spec.volumeAttributesClassName || '<none>'
    return <TextCell key="vac" content={vac} style={style} />
}
