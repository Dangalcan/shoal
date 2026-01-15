import type {
  PersistentVolumeClaim,
  PersistentVolume,
} from '../../../types/k8s-types';

export const mockPVC: PersistentVolumeClaim[] = [
  {
    metadata: {
      name: 'pvc-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T10:00:00Z',
      annotations: { 'volume.kubernetes.io/selected-node': 'node-PVC-TARGET' },
    },
    status: {
      phase: 'Bound',
      capacity: { storage: '5Gi' },
    },
    spec: {
      volumeName: 'pv-1',
      accessModes: ['ReadWriteOnce'],
      storageClassName: 'gp2',
      resources: { requests: { storage: '5Gi' } },
      volumeMode: 'Block',
    },
  },
  {
    metadata: {
      name: 'pvc-2',
      namespace: 'default',
      creationTimestamp: '2023-01-01T10:00:00Z',
    },
    status: {
      phase: 'Pending',
      capacity: { storage: '10Gi' },
    },
    spec: {
      volumeName: 'pv-2',
      accessModes: ['ReadWriteMany'],
      storageClassName: 'standard',
      volumeMode: 'Filesystem',
    },
  },
];

export const mockPV: PersistentVolume[] = [
  {
    metadata: { name: 'pv-1', creationTimestamp: '2024-01-01T00:00:00Z' },
    spec: {
      capacity: { storage: '10Gi' },
      accessModes: ['ReadWriteOnce'],
      persistentVolumeReclaimPolicy: 'Retain',
      storageClassName: 'gp2',
      volumeMode: 'Filesystem',
    },
    status: { phase: 'Bound' },
  },
];

export const mockSC: any[] = [
  {
    metadata: { name: 'sc-1', creationTimestamp: '2024-01-01T00:00:00Z' },
    provisioner: 'ebs.csi.aws.com',
    reclaimPolicy: 'Delete',
    volumeBindingMode: 'Immediate',
    allowVolumeExpansion: true,
  },
];

export const mockVS: any[] = [
  {
    metadata: {
      name: 'vs-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    spec: {
      volumeSnapshotClassName: 'vsc-1',
      source: { persistentVolumeClaimName: 'pvc-1' },
    },
    status: { readyToUse: true, restoreSize: '5Gi' },
  },
];

export const mockVSC: any[] = [
  {
    metadata: { name: 'vsc-1', creationTimestamp: '2024-01-01T00:00:00Z' },
    driver: 'ebs.csi.aws.com',
    deletionPolicy: 'Delete',
  },
];
