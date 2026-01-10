import type { K8sResource } from '../../types/k8s-types';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export type SorterFunction = (a: K8sResource, b: K8sResource) => number;
