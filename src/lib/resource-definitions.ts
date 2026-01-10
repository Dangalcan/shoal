import {
  Box,
  Activity,
  Shield,
  List,
  Gauge,
  Database,
  Globe,
  Lock,
  FileText,
  Server,
  Layers,
  Clock,
} from 'lucide-react';

export type ResourceType =
  | 'pods'
  | 'deployments'
  | 'replicasets'
  | 'daemonsets'
  | 'jobs'
  | 'cronjobs'
  | 'services'
  | 'statefulsets'
  | 'hpa'
  | 'persistentvolumeclaim'
  | 'ingress'
  | 'secrets'
  | 'configmap'
  | 'nodes';

export interface ColumnDef {
  id: string;
  label: string;
  minWidth: number;
}

export const ALL_TABS: { id: ResourceType; label: string; icon: any }[] = [
  { id: 'pods', label: 'Pods', icon: Box },
  { id: 'deployments', label: 'Deployments', icon: Activity },
  { id: 'replicasets', label: 'ReplicaSets', icon: Layers },
  { id: 'daemonsets', label: 'DaemonSets', icon: Box },
  { id: 'jobs', label: 'Jobs', icon: Clock },
  { id: 'cronjobs', label: 'CronJobs', icon: Clock },
  { id: 'services', label: 'Services', icon: Shield },
  { id: 'statefulsets', label: 'StatefulSets', icon: List },
  { id: 'hpa', label: 'HPAs', icon: Gauge },
  { id: 'persistentvolumeclaim', label: 'PVCs', icon: Database },
  { id: 'ingress', label: 'Ingresses', icon: Globe },
  { id: 'secrets', label: 'Secrets', icon: Lock },
  { id: 'configmap', label: 'ConfigMaps', icon: FileText },
  { id: 'nodes', label: 'Nodes', icon: Server },
];

export const COLUMN_DEFINITIONS: Record<ResourceType, ColumnDef[]> = {
  pods: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'status', label: 'Status', minWidth: 100 },
    { id: 'restarts', label: 'Restarts', minWidth: 80 },
    { id: 'age', label: 'Age', minWidth: 150 },
    { id: 'ip', label: 'IP', minWidth: 120 },
    { id: 'node', label: 'Node', minWidth: 150 },
    { id: 'nominated-node', label: 'Nominated Node', minWidth: 150 },
    { id: 'readiness-gates', label: 'Readiness Gates', minWidth: 150 },
    { id: 'containers', label: 'Containers', minWidth: 150 },
    { id: 'images', label: 'Images', minWidth: 200 },
    { id: 'selector', label: 'Selector', minWidth: 200 },
  ],
  deployments: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'ready', label: 'Ready', minWidth: 100 },
    { id: 'updated', label: 'Up-To-Date', minWidth: 100 },
    { id: 'available', label: 'Available', minWidth: 100 },
    { id: 'age', label: 'Age', minWidth: 150 },
    { id: 'containers', label: 'Containers', minWidth: 150 },
    { id: 'images', label: 'Images', minWidth: 200 },
    { id: 'selector', label: 'Selector', minWidth: 200 },
  ],
  replicasets: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'desired', label: 'Desired', minWidth: 80 },
    { id: 'current', label: 'Current', minWidth: 80 },
    { id: 'ready', label: 'Ready', minWidth: 80 },
    { id: 'age', label: 'Age', minWidth: 150 },
    { id: 'containers', label: 'Containers', minWidth: 150 },
    { id: 'images', label: 'Images', minWidth: 200 },
    { id: 'selector', label: 'Selector', minWidth: 200 },
  ],
  daemonsets: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'desired', label: 'Desired', minWidth: 80 },
    { id: 'current', label: 'Current', minWidth: 80 },
    { id: 'ready', label: 'Ready', minWidth: 80 },
    { id: 'updated', label: 'Up-To-Date', minWidth: 100 },
    { id: 'available', label: 'Available', minWidth: 100 },
    { id: 'node-selector', label: 'Node Selector', minWidth: 150 },
    { id: 'age', label: 'Age', minWidth: 150 },
    { id: 'containers', label: 'Containers', minWidth: 150 },
    { id: 'images', label: 'Images', minWidth: 200 },
  ],
  jobs: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'status', label: 'Status', minWidth: 100 },
    { id: 'completions', label: 'Completions', minWidth: 120 },
    { id: 'duration', label: 'Duration', minWidth: 100 },
    { id: 'age', label: 'Age', minWidth: 150 },
    { id: 'containers', label: 'Containers', minWidth: 150 },
    { id: 'images', label: 'Images', minWidth: 200 },
    { id: 'selector', label: 'Selector', minWidth: 200 },
  ],
  cronjobs: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'schedule', label: 'Schedule', minWidth: 150 },
    { id: 'suspend', label: 'Suspend', minWidth: 100 },
    { id: 'active', label: 'Active', minWidth: 100 },
    { id: 'last-schedule', label: 'Last Schedule', minWidth: 150 },
    { id: 'age', label: 'Age', minWidth: 150 },
    { id: 'containers', label: 'Containers', minWidth: 150 },
    { id: 'images', label: 'Images', minWidth: 200 },
    { id: 'selector', label: 'Selector', minWidth: 200 },
  ],
  services: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'type', label: 'Type', minWidth: 100 },
    { id: 'cluster-ip', label: 'Cluster IP', minWidth: 150 },
    { id: 'external-ip', label: 'External IP', minWidth: 150 },
    { id: 'ports', label: 'Port(s)', minWidth: 150 },
    { id: 'age', label: 'Age', minWidth: 150 },
    { id: 'selector', label: 'Selector', minWidth: 200 },
  ],
  statefulsets: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'ready', label: 'Ready', minWidth: 100 },
    { id: 'age', label: 'Age', minWidth: 150 },
    { id: 'containers', label: 'Containers', minWidth: 150 },
    { id: 'images', label: 'Images', minWidth: 200 },
  ],
  hpa: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'reference', label: 'Reference', minWidth: 200 },
    { id: 'targets', label: 'Targets', minWidth: 150 },
    { id: 'minpods', label: 'MinPods', minWidth: 80 },
    { id: 'maxpods', label: 'MaxPods', minWidth: 80 },
    { id: 'replicas', label: 'Replicas', minWidth: 80 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  persistentvolumeclaim: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'status', label: 'Status', minWidth: 100 },
    { id: 'volume', label: 'Volume', minWidth: 150 },
    { id: 'capacity', label: 'Capacity', minWidth: 100 },
    { id: 'access-modes', label: 'Access Modes', minWidth: 150 },
    { id: 'storageclass', label: 'StorageClass', minWidth: 150 },
    { id: 'volumemode', label: 'Volume Mode', minWidth: 120 },
    { id: 'selected-node', label: 'Volume Node', minWidth: 150 },
    { id: 'vac', label: 'VolumeAttributesClass', minWidth: 150 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  ingress: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'class', label: 'Class', minWidth: 120 },
    { id: 'hosts', label: 'Hosts', minWidth: 200 },
    { id: 'address', label: 'Address', minWidth: 150 },
    { id: 'ports', label: 'Ports', minWidth: 100 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  secrets: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'type', label: 'Type', minWidth: 150 },
    { id: 'data', label: 'Data', minWidth: 80 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  configmap: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'data', label: 'Data', minWidth: 80 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  nodes: [
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'status', label: 'Status', minWidth: 100 },
    { id: 'roles', label: 'Roles', minWidth: 120 },
    { id: 'age', label: 'Age', minWidth: 150 },
    { id: 'version', label: 'Version', minWidth: 120 },
    { id: 'internal-ip', label: 'Internal IP', minWidth: 150 },
    { id: 'external-ip', label: 'External IP', minWidth: 150 },
    { id: 'os-image', label: 'OS Image', minWidth: 200 },
    { id: 'kernel-version', label: 'Kernel Version', minWidth: 200 },
    { id: 'container-runtime', label: 'Container Runtime', minWidth: 200 },
  ],
};
