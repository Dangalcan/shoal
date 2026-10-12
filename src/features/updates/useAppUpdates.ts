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
    const show = (status: UpdateStatus) => {
      switch (status.state) {
        case 'available':
          toast.info(`Update available (v${status.version}). Downloading...`, {
            id: 'app-update-available',
          });
          break;
        case 'downloaded':
          toast.success(`Update v${status.version} is ready.`, {
            id: 'app-update-downloaded',
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
    };
    const off = api.onUpdateStatus(show);
    // The start-up check can finish before this subscription exists (and a
    // reload drops the toasts): ask for the last status once. Toast ids keep
    // a status that arrives both ways from showing twice.
    let cancelled = false;
    void api.getUpdateStatus?.().then((result) => {
      if (!cancelled && result?.success && result.data) show(result.data);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [api]);
}
