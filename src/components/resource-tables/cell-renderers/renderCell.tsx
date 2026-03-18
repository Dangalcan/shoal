/**
 * Cell renderer mapping function
 * Maps column IDs to appropriate cell renderer components
 */

import React from 'react'
import type { K8sResource } from '../../../types/k8s-types'
import type { ResourceType } from '../../../lib/resource-definitions'
import { TextCell } from '../ResourceCells'
import * as Cells from './index'

interface RenderCellOptions {
    colId: string
    resource: K8sResource
    resourceType: ResourceType
    style: React.CSSProperties
}

/**
 * Renders a cell based on column ID and resource type
 * This function replaces the massive switch statement in ResourceRows.tsx
 */
export const renderCell = ({ colId, resource, resourceType, style }: RenderCellOptions) => {
    const cellProps = { resource, style }
    const cellPropsWithType = { resource, resourceType, style }

    // Common cells used across all resource types
    switch (colId) {
        case 'namespace':
            return <Cells.NamespaceCell {...cellProps as any} />
        case 'age':
            return <Cells.AgeCell {...cellProps as any} />
        case 'status':
            return <Cells.StatusCell {...cellPropsWithType as any} />
        case 'selector':
            return <Cells.SelectorCell {...cellProps as any} />
        case 'containers':
            return <Cells.ContainersCell {...cellProps as any} />
        case 'images':
            return <Cells.ImagesCell {...cellProps as any} />
        case 'data':
            return <Cells.DataCountCell {...cellProps as any} />
    }

    // Pod-specific cells
    if (resourceType === 'pods') {
        switch (colId) {
            case 'restarts':
                return <Cells.RestartsCell {...cellProps as any} />
            case 'ip':
                return <Cells.PodIPCell {...cellProps as any} />
            case 'node':
                return <Cells.NodeNameCell {...cellProps as any} />
            case 'nominated-node':
                return <Cells.NominatedNodeCell {...cellProps as any} />
            case 'readiness-gates':
                return <Cells.ReadinessGatesCell {...cellProps as any} />
        }
    }

    // Node-specific cells
    if (resourceType === 'nodes') {
        switch (colId) {
            case 'roles':
                return <Cells.RolesCell {...cellProps as any} />
            case 'version':
                return <Cells.VersionCell {...cellProps as any} />
            case 'internal-ip':
                return <Cells.NodeInternalIPCell {...cellProps as any} />
            case 'external-ip':
                return <Cells.NodeExternalIPCell {...cellProps as any} />
            case 'os-image':
                return <Cells.OSImageCell {...cellProps as any} />
            case 'kernel-version':
                return <Cells.KernelVersionCell {...cellProps as any} />
            case 'container-runtime':
                return <Cells.ContainerRuntimeCell {...cellProps as any} />
        }
    }

    // HPA-specific cells
    if (resourceType === 'hpa') {
        switch (colId) {
            case 'reference':
                return <Cells.HPAReferenceCell {...cellProps as any} />
            case 'targets':
                return <Cells.HPATargetsCell {...cellProps as any} />
            case 'minpods':
                return <Cells.MinPodsCell {...cellProps as any} />
            case 'maxpods':
                return <Cells.MaxPodsCell {...cellProps as any} />
            case 'replicas':
                return <Cells.ReplicasCell {...cellProps as any} />
        }
    }

    // CronJob-specific cells
    if (resourceType === 'cronjobs') {
        switch (colId) {
            case 'schedule':
                return <Cells.CronJobScheduleCell {...cellProps as any} />
            case 'last-schedule':
                return <Cells.CronJobLastScheduleCell {...cellProps as any} />
        }
    }

    // Secret-specific cells
    if (resourceType === 'secrets') {
        switch (colId) {
            case 'type':
                return <Cells.SecretTypeCell {...cellProps as any} />
        }
    }

    // Workload cells (Deployments, ReplicaSets, DaemonSets, StatefulSets)
    const workloadTypes: ResourceType[] = ['deployments', 'replicasets', 'daemonsets', 'statefulsets', 'replicationcontroller']
    if (workloadTypes.includes(resourceType)) {
        switch (colId) {
            case 'ready':
                return <Cells.ReadyCell {...cellPropsWithType as any} />
            case 'desired':
                return <Cells.DesiredCell {...cellPropsWithType as any} />
            case 'current':
                return <Cells.CurrentCell {...cellPropsWithType as any} />
            case 'updated':
                return <Cells.UpdatedCell {...cellPropsWithType as any} />
            case 'available':
                return <Cells.AvailableCell {...cellPropsWithType as any} />
        }
    }

    // Job-specific cells
    if (resourceType === 'jobs') {
        switch (colId) {
            case 'completions':
                return <Cells.CompletionsCell {...cellProps as any} />
            case 'duration':
                return <Cells.DurationCell {...cellProps as any} />
        }
    }

    // Network cells (Services, Ingress)
    if (resourceType === 'services' || resourceType === 'ingress') {
        switch (colId) {
            case 'type':
                return <Cells.ServiceTypeCell {...cellProps as any} />
            case 'cluster-ip':
                return <Cells.ClusterIPCell {...cellProps as any} />
            case 'external-ip':
                return <Cells.ExternalIPCell {...cellProps as any} />
            case 'ports':
                return <Cells.PortsCell resource={resource} resourceType={resourceType} style={style} />
        }
    }

    if (resourceType === 'ingress') {
        switch (colId) {
            case 'class':
                return <Cells.IngressClassCell {...cellProps as any} />
            case 'hosts':
                return <Cells.HostsCell {...cellProps as any} />
            case 'address':
                return <Cells.AddressCell {...cellProps as any} />
        }
    }

    // Storage cells (PV, PVC, StorageClass)
    const storageTypes: ResourceType[] = ['persistentvolume', 'persistentvolumeclaim', 'storageclass']
    if (storageTypes.includes(resourceType)) {
        switch (colId) {
            case 'capacity':
                return <Cells.CapacityCell {...cellProps as any} />
            case 'access-modes':
                return <Cells.AccessModesCell {...cellProps as any} />
            case 'storageclass':
                return <Cells.StorageClassCell {...cellProps as any} />
            case 'volumemode':
                return <Cells.VolumeModeCell {...cellProps as any} />
            case 'reclaim-policy':
                return <Cells.ReclaimPolicyCell {...cellProps as any} />
            case 'claim':
                return <Cells.ClaimCell {...cellProps as any} />
            case 'volume':
                return <Cells.VolumeCell {...cellProps as any} />
            case 'provisioner':
                return <Cells.ProvisionerCell {...cellProps as any} />
            case 'binding-mode':
                return <Cells.BindingModeCell {...cellProps as any} />
            case 'allow-expansion':
                return <Cells.AllowExpansionCell {...cellProps as any} />
            case 'selected-node':
                return <Cells.PVCSelectedNodeCell {...cellProps as any} />
            case 'vac':
                return <Cells.VACCell {...cellProps as any} />
        }
    }

    // Fallback: render remaining cells with generic logic
    return renderGenericCell({ colId, resource, resourceType, style })
}

/**
 * Renders generic cells for columns that don't have dedicated components
 * This is a fallback for less common columns
 */
function renderGenericCell(
    { colId, resource, resourceType, style }: RenderCellOptions
): React.ReactNode {
    const res = resource as any
    const spec = res.spec || {}
    const status = res.status || {}

    // Handle common properties dynamically if possible
    if (colId in res) {
        return <TextCell key={colId} content={String(res[colId])} style={style} />
    }
    if (colId in spec) {
        return <TextCell key={colId} content={String(spec[colId])} style={style} />
    }
    if (colId in status) {
        return <TextCell key={colId} content={String(status[colId])} style={style} />
    }

    // Return a placeholder for truly unknown columns
    if (import.meta.env.DEV) {
      console.warn(`[renderCell] No renderer for column "${colId}" — add a case to renderCell.tsx`);
    }
    return <TextCell key={colId} content="-" style={style} />
}
