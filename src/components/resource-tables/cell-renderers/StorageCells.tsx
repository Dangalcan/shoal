/**
 * Storage resource cell renderers (PersistentVolumes, PersistentVolumeClaims, StorageClasses)
 */

import React from 'react';
import type {
  PersistentVolume,
  PersistentVolumeClaim,
  K8sResource,
} from '../../../types/k8s-types';
import { stringField } from '../../../lib/type-guards';
import { TextCell } from '../ResourceCells';

interface CellProps {
  resource: K8sResource;
  style: React.CSSProperties;
}

/** The `spec` fields these cells read; PVs and PVCs share them. */
interface StorageSpec {
  capacity?: { storage?: string };
  accessModes?: string[];
  storageClassName?: string;
  volumeMode?: string;
  volumeAttributesClassName?: string;
}

interface StorageStatus {
  capacity?: { storage?: string };
}

/** A StorageClass keeps its fields at the top level, not under `spec`. */
interface StorageClassFields {
  provisioner?: string;
  volumeBindingMode?: string;
  allowVolumeExpansion?: boolean;
}

const storageSpec = (resource: K8sResource): StorageSpec =>
  (resource.spec ?? {}) as StorageSpec;
const storageStatus = (resource: K8sResource): StorageStatus =>
  (resource.status ?? {}) as StorageStatus;
const storageClassFields = (resource: K8sResource): StorageClassFields =>
  resource as unknown as StorageClassFields;

/**
 * Renders storage capacity
 */
export const CapacityCell: React.FC<CellProps> = ({ resource, style }) => {
  const capacity =
    storageStatus(resource).capacity?.storage ||
    storageSpec(resource).capacity?.storage ||
    '<none>';
  return <TextCell key="capacity" content={capacity} style={style} />;
};

/**
 * Renders access modes
 */
export const AccessModesCell: React.FC<CellProps> = ({ resource, style }) => {
  const modes = storageSpec(resource).accessModes?.join(', ') || '<none>';
  return <TextCell key="access-modes" content={modes} style={style} />;
};

/**
 * Renders storage class name
 */
export const StorageClassCell: React.FC<CellProps> = ({ resource, style }) => {
  return (
    <TextCell
      key="storageclass"
      content={storageSpec(resource).storageClassName || '<none>'}
      style={style}
    />
  );
};

/**
 * Renders volume mode
 */
export const VolumeModeCell: React.FC<CellProps> = ({ resource, style }) => {
  return (
    <TextCell
      key="volumemode"
      content={storageSpec(resource).volumeMode || 'Filesystem'}
      style={style}
    />
  );
};

/**
 * Renders reclaim policy
 */
export const ReclaimPolicyCell: React.FC<CellProps> = ({ resource, style }) => {
  const reclaimPolicy =
    (resource as PersistentVolume).spec?.persistentVolumeReclaimPolicy ||
    stringField(resource, 'reclaimPolicy') ||
    'Delete';
  return (
    <TextCell key="reclaim-policy" content={reclaimPolicy} style={style} />
  );
};

/**
 * Renders PV claim reference
 */
export const ClaimCell: React.FC<CellProps> = ({ resource, style }) => {
  const claimRef = (resource as PersistentVolume).spec?.claimRef;
  const claimContent = claimRef
    ? `${claimRef.namespace}/${claimRef.name}`
    : '<none>';
  return (
    <TextCell key="claim" variant="mono" content={claimContent} style={style} />
  );
};

/**
 * Renders volume name
 */
export const VolumeCell: React.FC<CellProps> = ({ resource, style }) => {
  return (
    <TextCell
      key="volume"
      variant="mono"
      content={(resource as PersistentVolumeClaim).spec?.volumeName || '<none>'}
      style={style}
    />
  );
};

/**
 * Renders storage provisioner
 */
export const ProvisionerCell: React.FC<CellProps> = ({ resource, style }) => {
  const provisioner = storageClassFields(resource).provisioner || '<none>';
  return <TextCell key="provisioner" content={provisioner} style={style} />;
};

/**
 * Renders volume binding mode
 */
export const BindingModeCell: React.FC<CellProps> = ({ resource, style }) => {
  const volumeBindingMode =
    storageClassFields(resource).volumeBindingMode || '<none>';
  return (
    <TextCell key="binding-mode" content={volumeBindingMode} style={style} />
  );
};

/**
 * Renders allow volume expansion
 */
export const AllowExpansionCell: React.FC<CellProps> = ({
  resource,
  style,
}) => {
  const allowExpansion =
    storageClassFields(resource).allowVolumeExpansion ?? false;
  return (
    <TextCell
      key="allow-expansion"
      content={String(allowExpansion)}
      style={style}
    />
  );
};

/**
 * Renders PVC selected node (from annotation)
 */
export const PVCSelectedNodeCell: React.FC<CellProps> = ({
  resource,
  style,
}) => {
  const annotations = resource.metadata?.annotations || {};
  const node = annotations['volume.kubernetes.io/selected-node'] || '<none>';
  return <TextCell key="selected-node" content={node} style={style} />;
};

/**
 * Renders VolumeAttributesClass
 */
export const VACCell: React.FC<CellProps> = ({ resource, style }) => {
  const vac = storageSpec(resource).volumeAttributesClassName || '<none>';
  return <TextCell key="vac" content={vac} style={style} />;
};
