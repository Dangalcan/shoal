/**
 * Cell renderer mapping
 *
 * Maps a column id to the cell component that renders it: the columns every
 * resource kind shares first, then the kind's own columns.
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

type CellRenderer = (
  resource: K8sResource,
  resourceType: ResourceType,
  style: React.CSSProperties
) => React.ReactNode;

/** Cell renderers by column id. */
type CellMap = Record<string, CellRenderer>;

/** Columns shared by every resource kind. */
const COMMON_CELLS: CellMap = {
  namespace: (resource, _t, style) => (
    <Cells.NamespaceCell resource={resource} style={style} />
  ),
  age: (resource, _t, style) => (
    <Cells.AgeCell resource={resource} style={style} />
  ),
  status: (resource, resourceType, style) => (
    <Cells.StatusCell
      resource={resource}
      resourceType={resourceType}
      style={style}
    />
  ),
  selector: (resource, _t, style) => (
    <Cells.SelectorCell resource={resource} style={style} />
  ),
  containers: (resource, _t, style) => (
    <Cells.ContainersCell resource={resource} style={style} />
  ),
  images: (resource, _t, style) => (
    <Cells.ImagesCell resource={resource} style={style} />
  ),
  data: (resource, _t, style) => (
    <Cells.DataCountCell resource={resource} style={style} />
  ),
};

// The active tab decides the kind of every row, so the casts below only
// state what `resourceType` already guarantees.
const POD_CELLS: CellMap = {
  restarts: (r, _t, style) => (
    <Cells.RestartsCell resource={r as Pod} style={style} />
  ),
  ip: (r, _t, style) => <Cells.PodIPCell resource={r as Pod} style={style} />,
  node: (r, _t, style) => (
    <Cells.NodeNameCell resource={r as Pod} style={style} />
  ),
  'nominated-node': (r, _t, style) => (
    <Cells.NominatedNodeCell resource={r as Pod} style={style} />
  ),
  'readiness-gates': (r, _t, style) => (
    <Cells.ReadinessGatesCell resource={r as Pod} style={style} />
  ),
};

const NODE_CELLS: CellMap = {
  roles: (r, _t, style) => <Cells.RolesCell resource={r} style={style} />,
  version: (r, _t, style) => <Cells.VersionCell resource={r} style={style} />,
  'internal-ip': (r, _t, style) => (
    <Cells.NodeInternalIPCell resource={r} style={style} />
  ),
  'external-ip': (r, _t, style) => (
    <Cells.NodeExternalIPCell resource={r} style={style} />
  ),
  'os-image': (r, _t, style) => (
    <Cells.OSImageCell resource={r} style={style} />
  ),
  'kernel-version': (r, _t, style) => (
    <Cells.KernelVersionCell resource={r} style={style} />
  ),
  'container-runtime': (r, _t, style) => (
    <Cells.ContainerRuntimeCell resource={r} style={style} />
  ),
};

const HPA_CELLS: CellMap = {
  reference: (r, _t, style) => (
    <Cells.HPAReferenceCell resource={r} style={style} />
  ),
  targets: (r, _t, style) => (
    <Cells.HPATargetsCell resource={r} style={style} />
  ),
  minpods: (r, _t, style) => <Cells.MinPodsCell resource={r} style={style} />,
  maxpods: (r, _t, style) => <Cells.MaxPodsCell resource={r} style={style} />,
  replicas: (r, _t, style) => <Cells.ReplicasCell resource={r} style={style} />,
};

const CRONJOB_CELLS: CellMap = {
  schedule: (r, _t, style) => (
    <Cells.CronJobScheduleCell resource={r} style={style} />
  ),
  'last-schedule': (r, _t, style) => (
    <Cells.CronJobLastScheduleCell resource={r} style={style} />
  ),
};

const SECRET_CELLS: CellMap = {
  type: (r, _t, style) => <Cells.SecretTypeCell resource={r} style={style} />,
};

/** Deployments, ReplicaSets, DaemonSets, StatefulSets, ReplicationControllers. */
const WORKLOAD_CELLS: CellMap = {
  ready: (r, t, style) => (
    <Cells.ReadyCell resource={r} resourceType={t} style={style} />
  ),
  desired: (r, t, style) => (
    <Cells.DesiredCell resource={r} resourceType={t} style={style} />
  ),
  current: (r, t, style) => (
    <Cells.CurrentCell resource={r} resourceType={t} style={style} />
  ),
  updated: (r, t, style) => (
    <Cells.UpdatedCell resource={r} resourceType={t} style={style} />
  ),
  available: (r, t, style) => (
    <Cells.AvailableCell resource={r} resourceType={t} style={style} />
  ),
};

const JOB_CELLS: CellMap = {
  completions: (r, _t, style) => (
    <Cells.CompletionsCell resource={r} style={style} />
  ),
  duration: (r, _t, style) => <Cells.DurationCell resource={r} style={style} />,
};

/**
 * Services and Ingresses. The service cells read `spec.type`,
 * `spec.clusterIP` and the load balancer status, which an Ingress simply
 * does not have, so they fall back to their placeholders for that tab.
 */
const SERVICE_CELLS: CellMap = {
  type: (r, _t, style) => (
    <Cells.ServiceTypeCell resource={r as Service} style={style} />
  ),
  'cluster-ip': (r, _t, style) => (
    <Cells.ClusterIPCell resource={r as Service} style={style} />
  ),
  'external-ip': (r, _t, style) => (
    <Cells.ExternalIPCell resource={r as Service} style={style} />
  ),
  ports: (r, t, style) => (
    <Cells.PortsCell resource={r} resourceType={t} style={style} />
  ),
};

const INGRESS_CELLS: CellMap = {
  class: (r, _t, style) => (
    <Cells.IngressClassCell resource={r as Ingress} style={style} />
  ),
  hosts: (r, _t, style) => (
    <Cells.HostsCell resource={r as Ingress} style={style} />
  ),
  address: (r, _t, style) => (
    <Cells.AddressCell resource={r as Ingress} style={style} />
  ),
};

/** PersistentVolumes, PersistentVolumeClaims, StorageClasses. */
const STORAGE_CELLS: CellMap = {
  capacity: (r, _t, style) => <Cells.CapacityCell resource={r} style={style} />,
  'access-modes': (r, _t, style) => (
    <Cells.AccessModesCell resource={r} style={style} />
  ),
  storageclass: (r, _t, style) => (
    <Cells.StorageClassCell resource={r} style={style} />
  ),
  volumemode: (r, _t, style) => (
    <Cells.VolumeModeCell resource={r} style={style} />
  ),
  'reclaim-policy': (r, _t, style) => (
    <Cells.ReclaimPolicyCell resource={r} style={style} />
  ),
  claim: (r, _t, style) => <Cells.ClaimCell resource={r} style={style} />,
  volume: (r, _t, style) => <Cells.VolumeCell resource={r} style={style} />,
  provisioner: (r, _t, style) => (
    <Cells.ProvisionerCell resource={r} style={style} />
  ),
  'binding-mode': (r, _t, style) => (
    <Cells.BindingModeCell resource={r} style={style} />
  ),
  'allow-expansion': (r, _t, style) => (
    <Cells.AllowExpansionCell resource={r} style={style} />
  ),
  'selected-node': (r, _t, style) => (
    <Cells.PVCSelectedNodeCell resource={r} style={style} />
  ),
  vac: (r, _t, style) => <Cells.VACCell resource={r} style={style} />,
};

/** The columns each resource kind adds to the common ones. */
const CELLS_BY_TYPE: Partial<Record<ResourceType, CellMap>> = {
  pods: POD_CELLS,
  nodes: NODE_CELLS,
  hpa: HPA_CELLS,
  cronjobs: CRONJOB_CELLS,
  secrets: SECRET_CELLS,
  deployments: WORKLOAD_CELLS,
  replicasets: WORKLOAD_CELLS,
  daemonsets: WORKLOAD_CELLS,
  statefulsets: WORKLOAD_CELLS,
  replicationcontroller: WORKLOAD_CELLS,
  jobs: JOB_CELLS,
  services: SERVICE_CELLS,
  ingress: { ...SERVICE_CELLS, ...INGRESS_CELLS },
  persistentvolume: STORAGE_CELLS,
  persistentvolumeclaim: STORAGE_CELLS,
  storageclass: STORAGE_CELLS,
};

/**
 * Renders a cell based on column ID and resource type.
 */
export const renderCell = ({
  colId,
  resource,
  resourceType,
  style,
}: RenderCellOptions) => {
  const renderer = COMMON_CELLS[colId] ?? CELLS_BY_TYPE[resourceType]?.[colId];
  if (renderer) return renderer(resource, resourceType, style);
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
