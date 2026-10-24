import { useCallback } from 'react';
import { handleAsyncOperation } from '../lib/async-operation-handler';
import { useApi } from '../services/api-context';

interface UseResourceActionsResult {
  handleRestart: (resName: string, ns: string, type: string) => Promise<void>;
  handleDelete: (resName: string, ns: string, type: string) => Promise<void>;
  handleScale: (
    resName: string,
    ns: string,
    type: string,
    replicas: number
  ) => Promise<void>;
}

export function useResourceActions(
  contextName: string | undefined,
  onActionComplete: () => void | Promise<void>
): UseResourceActionsResult {
  const api = useApi();

  const handleRestart = useCallback(
    async (resName: string, ns: string, type: string) => {
      if (!contextName) return;

      await handleAsyncOperation(
        () =>
          api.rolloutRestart({
            contextName,
            resourceType: type,
            resourceName: resName,
            namespace: ns,
          }),
        {
          loadingMessage: `Restarting ${type}/${resName}...`,
          successMessage: 'Restart triggered successfully',
          errorTitle: 'Failed to restart resource',
          onSuccess: onActionComplete,
        }
      );
    },
    [api, contextName, onActionComplete]
  );

  const handleDelete = useCallback(
    async (resName: string, ns: string, type: string) => {
      if (!contextName) return;

      await handleAsyncOperation(
        () =>
          api.deleteResource({
            contextName,
            resourceType: type,
            resourceName: resName,
            namespace: ns,
          }),
        {
          loadingMessage: `Deleting ${type}/${resName}...`,
          successMessage: 'Resource deleted successfully',
          errorTitle: 'Failed to delete resource',
          onSuccess: onActionComplete,
        }
      );
    },
    [api, contextName, onActionComplete]
  );

  const handleScale = useCallback(
    async (resName: string, ns: string, type: string, replicas: number) => {
      if (!contextName) return;

      await handleAsyncOperation(
        () =>
          api.scaleResource({
            contextName,
            resourceType: type,
            resourceName: resName,
            namespace: ns,
            replicas,
          }),
        {
          loadingMessage: `Scaling ${type}/${resName} to ${replicas} replicas...`,
          successMessage: `Scaled to ${replicas} replica${replicas === 1 ? '' : 's'}`,
          errorTitle: 'Failed to scale resource',
          onSuccess: onActionComplete,
        }
      );
    },
    [api, contextName, onActionComplete]
  );

  return { handleRestart, handleDelete, handleScale };
}
