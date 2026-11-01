import type { LucideIcon } from 'lucide-react';

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
  | 'configmaps'
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

export type ResourceCategory =
  | 'Workloads'
  | 'Networking'
  | 'Storage'
  | 'Configuration'
  | 'Access Control'
  | 'Cluster'
  | 'Advanced';

export interface ColumnDef {
  id: string;
  label: string;
  minWidth: number;
}

export interface ResourceConfig {
  id: ResourceType;
  label: string;
  category: ResourceCategory;
  icon: LucideIcon;
  columns: ColumnDef[];
  defaultVisibleColumns: string[];
  defaultHidden: boolean;
}
