import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useApi } from '../../services/api-context';
import { useAsyncData } from '../../hooks/useAsyncData';
import { handleAsyncOperation } from '../../lib/async-operation-handler';
import type { Result } from '../../types/result';
import type { PortForwardArgs, PortForwardInfo } from '../../types';

/**
 * Starts a forward with the standard toast flow. Shared by the
 * manager page hook and the per-resource Forward modal.
 */
export function startPortForwardOperation(
  start: (args: PortForwardArgs) => Promise<Result<PortForwardInfo>>,
  args: PortForwardArgs,
  onSuccess?: () => void | Promise<void>
): Promise<Result<PortForwardInfo>> {
  const target = `${args.resourceType}/${args.resourceName}`;
  return handleAsyncOperation(() => start(args), {
    loadingMessage: `Forwarding localhost:${args.localPort} → ${target}:${args.remotePort}...`,
    successMessage: `localhost:${args.localPort} → ${target}:${args.remotePort} active.`,
    errorTitle: 'Failed to start port forward',
    onSuccess,
  });
}

export interface UsePortForwardsResult {
  forwards: PortForwardInfo[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  startForward: (args: PortForwardArgs) => Promise<{ success: boolean }>;
  stopForward: (forward: PortForwardInfo) => Promise<{ success: boolean }>;
}

/**
 * Active port-forward tunnels. Refreshes the list when a tunnel dies in
 * the backend (pod deleted, connection dropped) and surfaces that as a
 * warning toast.
 */
export function usePortForwards(): UsePortForwardsResult {
  const api = useApi();

  const { data, loading, error, refetch } = useAsyncData<PortForwardInfo[]>({
    fetchFn: () => api.portForwardList(),
    errorTitle: 'Failed to load port forwards',
  });

  useEffect(() => {
    const unsubscribe = api.onPortForwardClosed((info, closeError) => {
      toast.warning(
        `Port forward ${info.resourceType}/${info.resourceName} ` +
          `(localhost:${info.localPort}) closed` +
          (closeError ? `: ${closeError}` : '')
      );
      refetch();
    });
    return unsubscribe;
  }, [api, refetch]);

  const startForward = useCallback(
    async (args: PortForwardArgs) => {
      const result = await startPortForwardOperation(
        api.portForwardStart,
        args,
        refetch
      );
      return { success: result.success };
    },
    [api, refetch]
  );

  const stopForward = useCallback(
    async (forward: PortForwardInfo) => {
      const result = await handleAsyncOperation(
        () => api.portForwardStop(forward.id),
        {
          loadingMessage: `Stopping forward on localhost:${forward.localPort}...`,
          successMessage: `Forward on localhost:${forward.localPort} stopped.`,
          errorTitle: 'Failed to stop port forward',
          onSuccess: refetch,
        }
      );
      return { success: result.success };
    },
    [api, refetch]
  );

  return {
    forwards: data ?? [],
    loading,
    error,
    refetch,
    startForward,
    stopForward,
  };
}
