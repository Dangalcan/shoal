import { toast } from 'sonner';
import { useCallback } from 'react';
import { handleError } from '../lib/error-handler';

interface UseResourceActionsResult {
  handleRestart: (resName: string, ns: string, type: string) => Promise<void>;
  handleDelete: (resName: string, ns: string, type: string) => Promise<void>;
}

export function useResourceActions(
  contextName: string | undefined,
  onActionComplete: () => void
): UseResourceActionsResult {
  const handleRestart = useCallback(
    async (resName: string, ns: string, type: string) => {
      if (!contextName) return;

      const promise = window.electron.rolloutRestart({
        contextName,
        resourceType: type,
        resourceName: resName,
        namespace: ns,
      });

      const toastId = toast.loading(`Restarting ${type}/${resName}...`);
      try {
        const result = await promise;
        if (result.success) {
          toast.success('Restart triggered successfully', { id: toastId });
          onActionComplete();
        } else {
          handleError(
            result.error || 'Failed to restart',
            'Failed to restart resource',
            { id: toastId }
          );
        }
      } catch (err) {
        handleError(err, 'Failed to restart resource', { id: toastId });
      }
    },
    [contextName, onActionComplete]
  );

  const handleDelete = useCallback(
    async (resName: string, ns: string, type: string) => {
      if (!contextName) return;
      if (
        !window.confirm(`Are you sure you want to delete ${type}/${resName}?`)
      )
        return;

      const promise = window.electron.deleteResource({
        contextName,
        resourceType: type,
        resourceName: resName,
        namespace: ns,
      });

      const toastId = toast.loading(`Deleting ${type}/${resName}...`);
      try {
        const result = await promise;
        if (result.success) {
          toast.success('Resource deleted successfully', { id: toastId });
          onActionComplete();
        } else {
          handleError(
            result.error || 'Failed to delete',
            'Failed to delete resource',
            { id: toastId }
          );
        }
      } catch (err) {
        handleError(err, 'Failed to delete resource', { id: toastId });
      }
    },
    [contextName, onActionComplete]
  );

  return { handleRestart, handleDelete };
}
