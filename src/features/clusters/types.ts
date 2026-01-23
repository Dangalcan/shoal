import { Result } from '../../types/result';

export interface ClusterState {
  clusters: string[];
  loading: boolean;
  currentContext: string;
  switching: string | null;
  deleting: string | null;
}

export interface ClusterContextValue extends ClusterState {
  fetchClusters: () => Promise<void>;
  switchContext: (contextName: string) => Promise<Result<void>>;
  deleteCluster: (name: string) => Promise<Result>;
}
