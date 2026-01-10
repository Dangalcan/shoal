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
  | 'endpointslices'
  | 'jobs'
  | 'cronjobs'
  | 'services'
  | 'statefulsets'
  | 'hpa'
  | 'persistentvolume'
  | 'persistentvolumeclaim'
  | 'ingress'
  | 'ingressclass'
  | 'networkpolicy'
  | 'secrets'
  | 'serviceaccounts'
  | 'storageclass'
  | 'volumesnapshot'
  | 'volumesnapshotclass'
  | 'poddisruptionbudget'
  | 'limitrange'
  | 'resourcequota'
  | 'priorityclass'
  | 'runtimeclass'
  | 'lease'
  | 'customresourcedefinition'
  | 'mutatingwebhookconfiguration'
  | 'validatingwebhookconfiguration'
  | 'apiservice'
  | 'replicationcontroller'
  | 'endpoints'
  | 'events'
  | 'bindings'
  | 'controllerrevisions'
  | 'certificatesigningrequest'
  | 'flowschema'
  | 'prioritylevelconfiguration'
  | 'role'
  | 'clusterrole'
  | 'rolebinding'
  | 'clusterrolebinding'
  | 'podsecurityadmission'
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
  { id: 'endpointslices', label: 'EndpointSlices', icon: Activity },
  { id: 'jobs', label: 'Jobs', icon: Clock },
  { id: 'cronjobs', label: 'CronJobs', icon: Clock },
  { id: 'services', label: 'Services', icon: Shield },
  { id: 'statefulsets', label: 'StatefulSets', icon: List },
  { id: 'hpa', label: 'HPAs', icon: Gauge },
  { id: 'persistentvolume', label: 'PVs', icon: Database },
  { id: 'persistentvolumeclaim', label: 'PVCs', icon: Database },
  { id: 'ingress', label: 'Ingresses', icon: Globe },
  { id: 'ingressclass', label: 'IngressClasses', icon: Globe },
  { id: 'networkpolicy', label: 'NetworkPolicies', icon: Shield },
  { id: 'secrets', label: 'Secrets', icon: Lock },
  { id: 'serviceaccounts', label: 'ServiceAccounts', icon: Lock },
  { id: 'storageclass', label: 'StorageClasses', icon: Database },
  { id: 'volumesnapshot', label: 'VolumeSnapshots', icon: Database },
  { id: 'volumesnapshotclass', label: 'VolumeSnapshotClasses', icon: Database },
  { id: 'poddisruptionbudget', label: 'PDBs', icon: Shield },
  { id: 'limitrange', label: 'LimitRanges', icon: Activity },
  { id: 'resourcequota', label: 'ResourceQuotas', icon: Activity },
  { id: 'priorityclass', label: 'PriorityClasses', icon: Gauge },
  { id: 'runtimeclass', label: 'RuntimeClasses', icon: Activity },
  { id: 'lease', label: 'Leases', icon: Clock },
  { id: 'customresourcedefinition', label: 'CRDs', icon: Layers },
  { id: 'mutatingwebhookconfiguration', label: 'MutatingWebhooks', icon: Lock },
  {
    id: 'validatingwebhookconfiguration',
    label: 'ValidatingWebhooks',
    icon: Lock,
  },
  { id: 'apiservice', label: 'APIServices', icon: Globe },
  { id: 'replicationcontroller', label: 'RCs', icon: Layers },
  { id: 'endpoints', label: 'Endpoints', icon: Activity },
  { id: 'events', label: 'Events', icon: Clock },
  { id: 'bindings', label: 'Bindings', icon: Lock },
  { id: 'controllerrevisions', label: 'ControllerRevisions', icon: Clock },
  { id: 'certificatesigningrequest', label: 'CSRs', icon: Lock },
  { id: 'flowschema', label: 'FlowSchemas', icon: Globe },
  {
    id: 'prioritylevelconfiguration',
    label: 'PriorityLevelConfigs',
    icon: Gauge,
  },
  { id: 'role', label: 'Roles', icon: Shield },
  { id: 'clusterrole', label: 'ClusterRoles', icon: Shield },
  { id: 'rolebinding', label: 'RoleBindings', icon: Lock },
  { id: 'clusterrolebinding', label: 'ClusterRoleBindings', icon: Lock },
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
  endpointslices: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'address-type', label: 'Address Type', minWidth: 120 },
    { id: 'ports', label: 'Ports', minWidth: 150 },
    { id: 'endpoints', label: 'Endpoints', minWidth: 200 },
    { id: 'service-name', label: 'Service Name', minWidth: 150 },
    { id: 'age', label: 'Age', minWidth: 150 },
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
  persistentvolume: [
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'capacity', label: 'Capacity', minWidth: 100 },
    { id: 'access-modes', label: 'Access Modes', minWidth: 150 },
    { id: 'reclaim-policy', label: 'Reclaim Policy', minWidth: 150 },
    { id: 'status', label: 'Status', minWidth: 100 },
    { id: 'claim', label: 'Claim', minWidth: 250 },
    { id: 'storageclass', label: 'StorageClass', minWidth: 150 },
    { id: 'volumemode', label: 'Volume Mode', minWidth: 120 },
    { id: 'reason', label: 'Reason', minWidth: 150 },
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
  ingressclass: [
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'controller', label: 'Controller', minWidth: 200 },
    { id: 'parameters', label: 'Parameters', minWidth: 150 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  networkpolicy: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'pod-selector', label: 'Pod Selector', minWidth: 200 },
    { id: 'policy-types', label: 'Policy Types', minWidth: 150 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  secrets: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'type', label: 'Type', minWidth: 150 },
    { id: 'data', label: 'Data', minWidth: 80 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  serviceaccounts: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'secrets', label: 'Secrets', minWidth: 100 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  storageclass: [
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'provisioner', label: 'Provisioner', minWidth: 200 },
    { id: 'reclaim-policy', label: 'Reclaim Policy', minWidth: 150 },
    { id: 'binding-mode', label: 'VolumeBindingMode', minWidth: 180 },
    { id: 'allow-expansion', label: 'AllowVolumeExpansion', minWidth: 150 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  volumesnapshot: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'ready-to-use', label: 'ReadyToUse', minWidth: 120 },
    { id: 'source', label: 'Source', minWidth: 200 },
    { id: 'snapshot-class', label: 'SnapshotClass', minWidth: 150 },
    { id: 'size', label: 'Size', minWidth: 100 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  volumesnapshotclass: [
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'driver', label: 'Driver', minWidth: 200 },
    { id: 'deletion-policy', label: 'DeletionPolicy', minWidth: 150 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  role: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  clusterrole: [
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  rolebinding: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'binding-role', label: 'Role', minWidth: 200 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  clusterrolebinding: [
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'binding-role', label: 'Role', minWidth: 200 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  configmap: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'data', label: 'Data', minWidth: 80 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  poddisruptionbudget: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'min-available', label: 'Min Available', minWidth: 120 },
    { id: 'max-unavailable', label: 'Max Unavailable', minWidth: 120 },
    { id: 'allowed-disruptions', label: 'Allowed Disruptions', minWidth: 150 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  limitrange: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  resourcequota: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  priorityclass: [
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'value', label: 'Value', minWidth: 100 },
    { id: 'global-default', label: 'Global Default', minWidth: 120 },
    { id: 'preemption-policy', label: 'Preemption Policy', minWidth: 150 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  runtimeclass: [
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'handler', label: 'Handler', minWidth: 150 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  lease: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'holder', label: 'Holder', minWidth: 200 },
    { id: 'duration', label: 'Duration', minWidth: 100 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  customresourcedefinition: [
    { id: 'name', label: 'Name', minWidth: 300 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  mutatingwebhookconfiguration: [
    { id: 'name', label: 'Name', minWidth: 250 },
    { id: 'webhooks', label: 'Webhooks', minWidth: 100 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  validatingwebhookconfiguration: [
    { id: 'name', label: 'Name', minWidth: 250 },
    { id: 'webhooks', label: 'Webhooks', minWidth: 100 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  apiservice: [
    { id: 'name', label: 'Name', minWidth: 250 },
    { id: 'service', label: 'Service', minWidth: 200 },
    { id: 'available', label: 'Available', minWidth: 100 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  replicationcontroller: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'desired', label: 'Desired', minWidth: 80 },
    { id: 'current', label: 'Current', minWidth: 80 },
    { id: 'ready', label: 'Ready', minWidth: 80 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  endpoints: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'endpoints', label: 'Endpoints', minWidth: 300 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  events: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'last-seen', label: 'Last Seen', minWidth: 150 },
    { id: 'type', label: 'Type', minWidth: 100 },
    { id: 'reason', label: 'Reason', minWidth: 150 },
    { id: 'object', label: 'Object', minWidth: 200 },
    { id: 'message', label: 'Message', minWidth: 400 },
  ],
  bindings: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  controllerrevisions: [
    { id: 'namespace', label: 'Namespace', minWidth: 120 },
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'controller', label: 'Controller', minWidth: 200 },
    { id: 'revision', label: 'Revision', minWidth: 100 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  certificatesigningrequest: [
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'requestor', label: 'Requestor', minWidth: 200 },
    { id: 'condition', label: 'Condition', minWidth: 150 },
    { id: 'signer-name', label: 'SignerName', minWidth: 200 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  flowschema: [
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'priority-level', label: 'PriorityLevel', minWidth: 150 },
    { id: 'strategy', label: 'Strategy', minWidth: 150 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
  prioritylevelconfiguration: [
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'type', label: 'Type', minWidth: 120 },
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
  podsecurityadmission: [
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'enforce', label: 'Enforce', minWidth: 120 },
    { id: 'audit', label: 'Audit', minWidth: 120 },
    { id: 'warn', label: 'Warn', minWidth: 120 },
    { id: 'age', label: 'Age', minWidth: 150 },
  ],
};
