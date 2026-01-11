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

      // @ts-ignore
      const promise = window.electron.rolloutRestart({
        contextName,
        resourceType: type,
        resourceName: resName,
        namespace: ns,
      });

      toast.promise(promise, {
        loading: `Restarting ${type}/${resName}...`,
        success: 'Restart triggered successfully',
        error: (err: any) => `Failed to restart: ${err.error || err.message}`,
      });

      try {
        await promise;
        onActionComplete();
      } catch (err) {
        handleError(err, 'Restart failed');
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

      // @ts-ignore
      const promise = window.electron.deleteResource({
        contextName,
        resourceType: type,
        resourceName: resName,
        namespace: ns,
      });

      toast.promise(promise, {
        loading: `Deleting ${type}/${resName}...`,
        success: 'Resource deleted successfully',
        error: (err: any) =>
          `Failed to delete resource: ${err.error || err.message}`,
      });

      try {
        const result = await promise;
        if (result.success) {
          onActionComplete();
        }
      } catch (err) {
        handleError(err, 'Delete failed');
      }
    },
    [contextName, onActionComplete]
  );

  return { handleRestart, handleDelete };
}
