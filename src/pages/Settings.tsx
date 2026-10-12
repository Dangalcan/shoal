import { Card, Button, Animate } from '../components/ui';
import { useSettings } from '../features/settings';
import { useNamespaces } from '../hooks';
import { useClusterContext } from '../features/clusters/ClusterContext';
import { AboutCard } from '../features/settings/AboutCard';
import { Globe, FolderOpen, Activity, RefreshCw, Check } from 'lucide-react';

export function Settings() {
  const {
    kubeconfigPath,
    defaultNamespace,
    autoRefresh,
    refreshInterval,
    saving,
    localSettingsSaved,
    setKubeconfigPath,
    setDefaultNamespace,
    setAutoRefresh,
    setRefreshInterval,
    handleSaveKubeconfig,
  } = useSettings();

  const { currentContext } = useClusterContext();

  const { namespaces, loading: loadingNamespaces } =
    useNamespaces(currentContext);

  // The renderer has no process.platform; the user agent names the OS.
  const kubeconfigPlaceholder = navigator.userAgent.includes('Windows')
    ? 'e.g. C:\\Users\\you\\.kube\\config-custom'
    : 'e.g. ~/.kube/config-custom';

  return (
    <div className="settings-page">
      <Animate type="fade">
        <header className="settings-page__header">
          <h2 className="settings-page__title">Settings</h2>
          <p className="settings-page__subtitle">
            Configure application behavior and global settings.
          </p>
        </header>
      </Animate>

      <div className="settings-page__grid">
        <Animate type="slide-up" delay={0}>
          <Card title="Core Configuration" icon={<Globe size={18} />}>
            <div className="settings-form">
              <div className="settings-form__group">
                <label className="settings-form__label">
                  Custom Kubeconfig Path
                </label>
                <div className="settings-form__input-group">
                  <input
                    type="text"
                    value={kubeconfigPath}
                    onChange={(e) => setKubeconfigPath(e.target.value)}
                    placeholder={kubeconfigPlaceholder}
                    className="settings-form__input"
                    aria-label="Kubeconfig Path"
                  />
                  <Button
                    onClick={handleSaveKubeconfig}
                    loading={saving}
                    icon={<FolderOpen size={16} />}
                    size="sm"
                  >
                    Set
                  </Button>
                </div>
                <p className="settings-form__hint">
                  Leave empty to use default system Kubeconfig.
                </p>
              </div>

              <div className="settings-form__group">
                <label className="settings-form__label">
                  Default Namespace
                </label>
                <select
                  value={defaultNamespace || 'all'}
                  onChange={(e) => setDefaultNamespace(e.target.value)}
                  className="settings-form__input"
                  aria-label="Default Namespace"
                  disabled={loadingNamespaces}
                >
                  <option value="all">All Namespaces</option>
                  {/* The real namespace called "default"; an empty value used to
                      stand for it but was read back as "all". */}
                  <option value="default">default</option>
                  {namespaces
                    .filter((ns) => ns !== 'all' && ns !== 'default')
                    .map((ns) => (
                      <option key={ns} value={ns}>
                        {ns}
                      </option>
                    ))}
                </select>
                <p className="settings-form__hint">
                  The namespace used by default when exploring a cluster.
                </p>
              </div>
            </div>
          </Card>
        </Animate>

        <Animate type="slide-up" delay={100}>
          <Card title="Appearance & Performance" icon={<Activity size={18} />}>
            <div className="settings-form">
              <div className="settings-form__row">
                <div>
                  <label className="settings-form__label">
                    Auto-Refresh Data
                  </label>
                  <p className="settings-form__hint">
                    Keep cluster and resource lists up-to-date automatically.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="settings-form__checkbox"
                  aria-label="Auto-Refresh Data"
                />
              </div>

              <div
                className={`settings-form__group ${!autoRefresh ? 'settings-page--hidden' : ''}`}
              >
                <label className="settings-form__label">
                  Refresh Interval (seconds)
                </label>
                <div className="settings-form__range-group">
                  <input
                    type="range"
                    min="2"
                    max="60"
                    value={refreshInterval}
                    onChange={(e) =>
                      setRefreshInterval(parseInt(e.target.value))
                    }
                    className="settings-form__range"
                    aria-label="Refresh Interval"
                  />
                  <span className="settings-form__range-value">
                    {refreshInterval}s
                  </span>
                </div>
                <p className="settings-form__hint">
                  Frequent refreshes may increase CPU usage.
                </p>
              </div>
            </div>
          </Card>
        </Animate>

        <Animate type="slide-up" delay={200}>
          <AboutCard />
        </Animate>
      </div>

      <div className="settings-footer">
        <div className="settings-footer__content">
          {localSettingsSaved ? (
            <>
              <Check size={12} className="text-success" />
              Settings saved.
            </>
          ) : (
            <>
              <RefreshCw size={12} />
              Settings are saved automatically.
            </>
          )}
        </div>
      </div>
    </div>
  );
}
