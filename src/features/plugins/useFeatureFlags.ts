import { useApi } from '../../services/api-context';
import { useAsyncData } from '../../hooks/useAsyncData';
import type { FeatureFlags } from '../../types.d';

/** Everything off until the main process answers. */
const DEFAULT_FLAGS: FeatureFlags = { marketplace: false };

/**
 * Feature switches decided by the main process (see electron/utils/env-utils.ts).
 * Defaults to all features off while loading or if the call fails.
 */
export function useFeatureFlags(): { flags: FeatureFlags; loading: boolean } {
  const api = useApi();
  const { data, loading } = useAsyncData<FeatureFlags>({
    fetchFn: () => api.getFeatureFlags(),
    errorTitle: 'Failed to load feature flags',
  });
  return { flags: data ?? DEFAULT_FLAGS, loading };
}
