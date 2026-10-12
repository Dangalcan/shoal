/**
 * Cell renderer mapping function
 * Maps column IDs to appropriate cell renderer components
 */

import React from 'react';
import type {
  Ingress,
  K8sResource,
  Pod,
  Service,
} from '../../../types/k8s-types';
import type { ResourceType } from '../../../lib/resources/resource-definitions';
import { isRecord } from '../../../lib/type-guards';
import { TextCell } from '../ResourceCells';
import * as Cells from './index';

interface RenderCellOptions {
  colId: string;
  resource: K8sResource;
  resourceType: ResourceType;
  style: React.CSSProperties;
}

/**
 * Renders a cell based on column ID and resource type
 * This function replaces the massive switch statement in ResourceRows.tsx
 */
export const renderCell = ({
  colId,
  resource,
  resourceType,
  style,
}: RenderCellOptions) => {
  const cellProps = { resource, style };
  const cellPropsWithType = { resource, resourceType, style };

  // Common cells used across all resource types
  switch (colId) {
    case 'namespace':
      return <Cells.NamespaceCell {...cellProps} />;
    case 'age':
      return <Cells.AgeCell {...cellProps} />;
    case 'status':
      return <Cells.StatusCell {...cellPropsWithType} />;
    case 'selector':
      return <Cells.SelectorCell {...cellProps} />;
    case 'containers':
      return <Cells.ContainersCell {...cellProps} />;
    case 'images':
      return <Cells.ImagesCell {...cellProps} />;
    case 'data':
      return <Cells.DataCountCell {...cellProps} />;
  }

  // Pod-specific cells. The active tab decides the kind of every row, so the
  // cast only states what `resourceType` already guarantees.
  if (resourceType === 'pods') {
    const podProps = { resource: resource as Pod, style };
    switch (colId) {
      case 'restarts':
        return <Cells.RestartsCell {...podProps} />;
      case 'ip':
        return <Cells.PodIPCell {...podProps} />;
      case 'node':
        return <Cells.NodeNameCell {...podProps} />;
      case 'nominated-node':
        return <Cells.NominatedNodeCell {...podProps} />;
      case 'readiness-gates':
        return <Cells.ReadinessGatesCell {...podProps} />;
    }
  }

  // Node-specific cells
  if (resourceType === 'nodes') {
    switch (colId) {
      case 'roles':
        return <Cells.RolesCell {...cellProps} />;
      case 'version':
        return <Cells.VersionCell {...cellProps} />;
      case 'internal-ip':
        return <Cells.NodeInternalIPCell {...cellProps} />;
      case 'external-ip':
        return <Cells.NodeExternalIPCell {...cellProps} />;
      case 'os-image':
        return <Cells.OSImageCell {...cellProps} />;
      case 'kernel-version':
        return <Cells.KernelVersionCell {...cellProps} />;
      case 'container-runtime':
        return <Cells.ContainerRuntimeCell {...cellProps} />;
    }
  }

  // HPA-specific cells
  if (resourceType === 'hpa') {
    switch (colId) {
      case 'reference':
        return <Cells.HPAReferenceCell {...cellProps} />;
      case 'targets':
        return <Cells.HPATargetsCell {...cellProps} />;
      case 'minpods':
        return <Cells.MinPodsCell {...cellProps} />;
      case 'maxpods':
        return <Cells.MaxPodsCell {...cellProps} />;
      case 'replicas':
        return <Cells.ReplicasCell {...cellProps} />;
    }
  }

  // CronJob-specific cells
  if (resourceType === 'cronjobs') {
    switch (colId) {
      case 'schedule':
        return <Cells.CronJobScheduleCell {...cellProps} />;
      case 'last-schedule':
        return <Cells.CronJobLastScheduleCell {...cellProps} />;
    }
  }

  // Secret-specific cells
  if (resourceType === 'secrets') {
    switch (colId) {
      case 'type':
        return <Cells.SecretTypeCell {...cellProps} />;
    }
  }

  // Workload cells (Deployments, ReplicaSets, DaemonSets, StatefulSets)
  const workloadTypes: ResourceType[] = [
    'deployments',
    'replicasets',
    'daemonsets',
    'statefulsets',
    'replicationcontroller',
  ];
  if (workloadTypes.includes(resourceType)) {
    switch (colId) {
      case 'ready':
        return <Cells.ReadyCell {...cellPropsWithType} />;
      case 'desired':
        return <Cells.DesiredCell {...cellPropsWithType} />;
      case 'current':
        return <Cells.CurrentCell {...cellPropsWithType} />;
      case 'updated':
        return <Cells.UpdatedCell {...cellPropsWithType} />;
      case 'available':
        return <Cells.AvailableCell {...cellPropsWithType} />;
    }
  }

  // Job-specific cells
  if (resourceType === 'jobs') {
    switch (colId) {
      case 'completions':
        return <Cells.CompletionsCell {...cellProps} />;
      case 'duration':
        return <Cells.DurationCell {...cellProps} />;
    }
  }

  // Network cells (Services, Ingress). The service cells read `spec.type`,
  // `spec.clusterIP` and the load balancer status, which an Ingress simply
  // does not have, so they fall back to their placeholders for that tab.
  if (resourceType === 'services' || resourceType === 'ingress') {
    const serviceProps = { resource: resource as Service, style };
    switch (colId) {
      case 'type':
        return <Cells.ServiceTypeCell {...serviceProps} />;
      case 'cluster-ip':
        return <Cells.ClusterIPCell {...serviceProps} />;
      case 'external-ip':
        return <Cells.ExternalIPCell {...serviceProps} />;
      case 'ports':
        return (
          <Cells.PortsCell
            resource={resource}
            resourceType={resourceType}
            style={style}
          />
        );
    }
  }

  if (resourceType === 'ingress') {
    const ingressProps = { resource: resource as Ingress, style };
    switch (colId) {
      case 'class':
        return <Cells.IngressClassCell {...ingressProps} />;
      case 'hosts':
        return <Cells.HostsCell {...ingressProps} />;
      case 'address':
        return <Cells.AddressCell {...ingressProps} />;
    }
  }

  // Storage cells (PV, PVC, StorageClass)
  const storageTypes: ResourceType[] = [
    'persistentvolume',
    'persistentvolumeclaim',
    'storageclass',
  ];
  if (storageTypes.includes(resourceType)) {
    switch (colId) {
      case 'capacity':
        return <Cells.CapacityCell {...cellProps} />;
      case 'access-modes':
        return <Cells.AccessModesCell {...cellProps} />;
      case 'storageclass':
        return <Cells.StorageClassCell {...cellProps} />;
      case 'volumemode':
        return <Cells.VolumeModeCell {...cellProps} />;
      case 'reclaim-policy':
        return <Cells.ReclaimPolicyCell {...cellProps} />;
      case 'claim':
        return <Cells.ClaimCell {...cellProps} />;
      case 'volume':
        return <Cells.VolumeCell {...cellProps} />;
      case 'provisioner':
        return <Cells.ProvisionerCell {...cellProps} />;
      case 'binding-mode':
        return <Cells.BindingModeCell {...cellProps} />;
      case 'allow-expansion':
        return <Cells.AllowExpansionCell {...cellProps} />;
      case 'selected-node':
        return <Cells.PVCSelectedNodeCell {...cellProps} />;
      case 'vac':
        return <Cells.VACCell {...cellProps} />;
    }
  }

  // Fallback: render remaining cells with generic logic
  return renderGenericCell({ colId, resource, resourceType, style });
};

/**
 * Renders generic cells for columns that don't have dedicated components
 * This is a fallback for less common columns
 */
function renderGenericCell({
  colId,
  resource,
  style,
}: RenderCellOptions): React.ReactNode {
  const res = resource as unknown as Record<string, unknown>;
  const spec = isRecord(res.spec) ? res.spec : {};
  const status = isRecord(res.status) ? res.status : {};

  // Handle common properties dynamically if possible
  if (colId in res) {
    return <TextCell key={colId} content={String(res[colId])} style={style} />;
  }
  if (colId in spec) {
    return <TextCell key={colId} content={String(spec[colId])} style={style} />;
  }
  if (colId in status) {
    return (
      <TextCell key={colId} content={String(status[colId])} style={style} />
    );
  }

  // Return a placeholder for truly unknown columns
  if (import.meta.env.DEV) {
    console.warn(
      `[renderCell] No renderer for column "${colId}" — add a case to renderCell.tsx`
    );
  }
  return <TextCell key={colId} content="-" style={style} />;
}
