import { useEffect } from 'react';
import { toast } from 'sonner';
import { useApi } from '../../services/api-context';
import type { UpdateStatus } from '../../types.d';

/**
 * Subscribes to app-update status from the main process and surfaces it to the
 * user: a toast when an update is downloading, and a persistent "Restart to
 * update" prompt once it is downloaded. Errors are logged in main, not shown.
 */
export function useAppUpdates(): void {
  const api = useApi();

  useEffect(() => {
    if (!api.onUpdateStatus) return;
    const off = api.onUpdateStatus((status: UpdateStatus) => {
      switch (status.state) {
        case 'available':
          toast.info(`Update available (v${status.version}). Downloading...`);
          break;
        case 'downloaded':
          toast.success(`Update v${status.version} is ready.`, {
            duration: Infinity,
            action: {
              label: 'Restart',
              onClick: () => {
                void api.installAppUpdate();
              },
            },
          });
          break;
        default:
          break;
      }
    });
    return off;
  }, [api]);
}
