import { useEffect, useRef, useState } from 'react';
import { Info, RefreshCw, FolderOpen, Bug } from 'lucide-react';
import { toast } from 'sonner';
import { Card, Button } from '../../components/ui';
import { useApi } from '../../services/api-context';
import { useAsyncData } from '../../hooks/useAsyncData';
import { buildIssueUrl } from '../../lib/error-reporting';
import type { AppInfo, UpdateStatus } from '../../types.d';

/** Settings card: version, update check, logs folder and bug reports. */
export function AboutCard() {
  const api = useApi();
  const { data: info } = useAsyncData<AppInfo>({
    fetchFn: () => api.getAppInfo(),
    errorTitle: 'Failed to load app information',
  });
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);

  // Answer a manual check; "available"/"downloaded" toasts come from
  // useAppUpdates (features/updates) for every check.
  useEffect(() => {
    if (!api.onUpdateStatus) return;
    return api.onUpdateStatus((status: UpdateStatus) => {
      if (!checkingRef.current) return;
      if (status.state === 'checking' || status.state === 'downloading') {
        return;
      }
      checkingRef.current = false;
      setChecking(false);
      if (status.state === 'not-available') {
        toast.success('You are on the latest version');
      } else if (status.state === 'error') {
        toast.error('Could not check for updates', {
          description: status.message,
        });
      }
    });
  }, [api]);

  const handleCheckForUpdates = async () => {
    checkingRef.current = true;
    setChecking(true);
    const result = await api.checkForAppUpdates();
    const outcome = result.success ? result.data : 'error';
    if (outcome === 'started') return; // the status listener above finishes
    checkingRef.current = false;
    setChecking(false);
    if (outcome === 'portable') {
      toast.info('This build cannot update itself', {
        description:
          'The portable version updates by downloading the new release.',
      });
    } else if (outcome === 'dev') {
      toast.info('Update checks only run in installed builds');
    } else if (!result.success) {
      toast.error('Could not check for updates', {
        description: result.error,
      });
    }
    // 'error' from a started check: the updater already reported it through
    // the status listener.
  };

  const handleOpenLogs = async () => {
    const result = await api.openLogsFolder();
    if (!result.success) {
      toast.error('Could not open the logs folder', {
        description: result.error,
      });
    }
  };

  const handleReport = () => {
    void api.openExternal(buildIssueUrl(info));
  };

  return (
    <Card title="About & Support" icon={<Info size={18} />}>
      <div className="settings-form">
        <div className="settings-form__row">
          <div>
            <label className="settings-form__label">Version</label>
            <p className="settings-form__hint">
              Shoal {info?.version ?? '...'}
              {info ? ` · ${info.platform} ${info.arch}` : ''}
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleCheckForUpdates}
            loading={checking}
            icon={<RefreshCw size={16} />}
          >
            Check for updates
          </Button>
        </div>

        <div className="settings-form__row">
          <div>
            <label className="settings-form__label">Logs</label>
            <p className="settings-form__hint">
              Errors are written to a local log file. Nothing is sent anywhere.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleOpenLogs}
            icon={<FolderOpen size={16} />}
          >
            Open logs folder
          </Button>
        </div>

        <div className="settings-form__row">
          <div>
            <label className="settings-form__label">Found a bug?</label>
            <p className="settings-form__hint">
              Opens a prefilled GitHub issue with your version and OS.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleReport}
            icon={<Bug size={16} />}
          >
            Report a problem
          </Button>
        </div>
      </div>
    </Card>
  );
}
