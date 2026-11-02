import { Result } from '../../types/result';

export interface ClusterState {
  clusters: string[];
  loading: boolean;
  /** Why the list could not be read; a missing kubectl has its own notice. */
  clustersError: string | null;
  currentContext: string;
  switching: string | null;
  deleting: string | null;
}

export interface ClusterContextValue extends ClusterState {
  fetchClusters: () => Promise<void>;
  switchContext: (contextName: string) => Promise<Result<void>>;
  deleteCluster: (name: string) => Promise<Result>;
}
