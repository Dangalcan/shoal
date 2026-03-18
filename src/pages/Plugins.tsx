/**
 * Plugins Management Page
 * 
 * Allows users to view, enable, disable, and manage installed plugins.
 */

import { useState } from 'react';
import { usePlugins } from '../features/plugins/PluginProvider';
import { LicenseActivationModal } from '../features/plugins/LicenseActivationModal';
import { MarketplaceList } from '../features/marketplace/MarketplaceList';
import { PluginSettingsModal } from '../features/plugins/PluginSettingsModal';
import { ConfirmModal } from '../components/modals/ConfirmModal';
import { Settings, RotateCcw, Package, Download, Trash2, Power, AlertCircle, User, Shield, Upload, Loader2 } from 'lucide-react';
import type { Plugin } from '../../electron/types/plugin-types';

export default function Plugins() {
  const { 
    plugins, 
    loading, 
    error, 
    enablePlugin, 
    disablePlugin, 
    refreshPlugins, 
    deactivateLicense,
    installPlugin,
    reloadPlugin,
    uninstallPlugin,
    importLocalPlugin
  } = usePlugins();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeModalPlugin, setActiveModalPlugin] = useState<Plugin | null>(null);
  const [activeSettingsPlugin, setActiveSettingsPlugin] = useState<Plugin | null>(null);
  const [activeTab, setActiveTab] = useState<'installed' | 'marketplace'>('installed');
  const [uninstallingPlugin, setUninstallingPlugin] = useState<Plugin | null>(null);
  const [updatingPlugin, setUpdatingPlugin] = useState<Plugin | null>(null);
  const [deactivatingLicensePlugin, setDeactivatingLicensePlugin] = useState<Plugin | null>(null);
  const [importing, setImporting] = useState(false);

  // Shared wrapper: sets loading/error state around an async plugin action
  const withAction = async (pluginId: string, fn: () => Promise<void>, fallbackMsg = 'Action failed') => {
    setActionLoading(pluginId);
    setActionError(null);
    try {
      await fn();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : fallbackMsg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTogglePlugin = (plugin: Plugin) =>
    withAction(
      plugin.manifest.id,
      () => plugin.state === 'enabled'
        ? disablePlugin(plugin.manifest.id)
        : enablePlugin(plugin.manifest.id),
      'Failed to toggle plugin'
    );

  const handleReloadPlugin = (plugin: Plugin) =>
    withAction(plugin.manifest.id, () => reloadPlugin(plugin.manifest.id), 'Failed to reload plugin');

  const handleUpdatePlugin = (plugin: Plugin) => setUpdatingPlugin(plugin);

  const confirmUpdate = () => {
    if (!updatingPlugin) return;
    withAction(
      updatingPlugin.manifest.id,
      async () => {
        await installPlugin(updatingPlugin.manifest.id);
        setUpdatingPlugin(null);
      },
      'Failed to update plugin'
    );
  };

  const handleImportPlugin = async () => {
    setImporting(true);
    setActionError(null);
    try {
      await importLocalPlugin();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to import plugin');
    } finally {
      setImporting(false);
    }
  };

  const handleUninstallPlugin = (plugin: Plugin) => setUninstallingPlugin(plugin);

  const confirmUninstall = () => {
    if (!uninstallingPlugin) return;
    withAction(
      uninstallingPlugin.manifest.id,
      async () => {
        if (uninstallingPlugin.state === 'enabled') {
          await disablePlugin(uninstallingPlugin.manifest.id);
        }
        await uninstallPlugin(uninstallingPlugin.manifest.id);
        setUninstallingPlugin(null);
      },
      'Failed to uninstall plugin'
    );
  };

  const PLUGIN_STATE_MAP: Record<string, { label: string; className: string }> = {
    enabled:  { label: 'Enabled',    className: 'plugin-state--enabled' },
    disabled: { label: 'Disabled',   className: 'plugin-state--disabled' },
    error:    { label: 'Error',      className: 'plugin-state--error' },
    loading:  { label: 'Loading...', className: 'plugin-state--loading' },
  };
  const getPluginStateClass = (state: string) => PLUGIN_STATE_MAP[state]?.className ?? '';
  const getPluginStateLabel = (state: string) => PLUGIN_STATE_MAP[state]?.label ?? state;

  if (loading) {
    return (
      <div className="plugins">
        <div className="plugins__header">
          <h1 className="plugins__title">Plugins</h1>
        </div>
        <div className="plugins__loading">
          <Loader2 size={48} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
          <p>Loading plugins...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="plugins">
        <div className="plugins__header">
          <h1 className="plugins__title">Plugins</h1>
        </div>
        <div className="plugins__error">
          <p className="error-message">{error}</p>
          <button onClick={refreshPlugins} className="btn btn--primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="plugins">
      <div className="plugins__header-container">
        <div className="plugins-header-main">
           <h1 className="plugins__title">Plugins</h1>
           <p className="plugins__subtitle">Manage your installed plugins or discover new ones.</p>
        </div>

        <div className="plugins-actions">
           <button
             className="btn btn--secondary btn--premium"
             onClick={handleImportPlugin}
             disabled={importing}
           >
             {importing ? (
               <Loader2 size={16} className="animate-spin" />
             ) : (
               <Upload size={16} />
             )}
             <span>Load Unpacked Plugin</span>
           </button>
        </div>
      </div>

      <div className="plugins-tabs-row">
        <div className="plugins-tabs">
          <button 
            className={`tab-btn ${activeTab === 'installed' ? 'active' : ''}`}
            onClick={() => setActiveTab('installed')}
          >
            <Package size={18} />
            Installed
          </button>
          <button 
            className={`tab-btn ${activeTab === 'marketplace' ? 'active' : ''}`}
            onClick={() => setActiveTab('marketplace')}
          >
            <Download size={18} />
            Marketplace
          </button>
        </div>
      </div>

      {actionError && (
        <div className="plugins__action-error">
          <p className="error-message">{actionError}</p>
        </div>
      )}

      {activeTab === 'marketplace' ? (
        <MarketplaceList />
      ) : (
        <>
          {plugins.length === 0 ? (
            <div className="plugins__empty">
              <p>No plugins installed.</p>
              <p className="plugins__empty-hint">
                Check out the Marketplace to find plugins!
              </p>
            </div>
          ) : (
            <div className="plugins__list">
              {plugins.map((plugin) => (
                <div key={plugin.manifest.id} className="plugin-card">
                  <div className="plugin-card__header">
                    <div className="plugin-card__info">
                      <div className="plugin-card__title-row">
                        <h3 className="plugin-card__name">{plugin.manifest.name}</h3>
                        {plugin.hasUpdate && (
                          <span className="plugin-update-badge" title={`Update available: v${plugin.latestVersion}`}>
                            Update Available
                          </span>
                        )}
                      </div>
                      <p className="plugin-card__version">
                        v{plugin.manifest.version}
                        {plugin.hasUpdate && <span className="latest-version"> (Latest: v{plugin.latestVersion})</span>}
                      </p>
                    </div>
                    <div className={`plugin-state ${getPluginStateClass(plugin.state)}`}>
                      {getPluginStateLabel(plugin.state)}
                    </div>
                  </div>

                  <p className="plugin-card__description">{plugin.manifest.description}</p>

                  <div className="plugin-card__meta">
                    <div className="plugin-card__meta-item">
                      <span className="plugin-card__meta-label">
                        <User size={14} style={{ display: 'inline', marginRight: '4px' }} />
                        Author:
                      </span>
                      <span className="plugin-card__meta-value">{plugin.manifest.author}</span>
                    </div>
                    <div className="plugin-card__meta-item">
                      <span className="plugin-card__meta-label">
                        <Shield size={14} style={{ display: 'inline', marginRight: '4px' }} />
                        License:
                      </span>
                      <span className="plugin-card__meta-value">
                        {plugin.manifest.license.type === 'free' 
                          ? plugin.manifest.license.spdx 
                          : `${plugin.manifest.license.type} (${plugin.manifest.license.spdx})`}
                      </span>
                    </div>
                    {plugin.manifest.permissions && plugin.manifest.permissions.length > 0 && (
                      <div className="plugin-card__meta-item">
                        <span className="plugin-card__meta-label">
                          <AlertCircle size={14} style={{ display: 'inline', marginRight: '4px' }} />
                          Permissions:
                        </span>
                        <span className="plugin-card__meta-value">
                          {plugin.manifest.permissions.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {plugin.error && (
                    <div className="plugin-card__error">
                      <strong>Error:</strong> {plugin.error}
                    </div>
                  )}

                  <div className="plugin-card__actions">
                    <button
                      onClick={() => handleTogglePlugin(plugin)}
                      disabled={actionLoading === plugin.manifest.id || plugin.state === 'loading'}
                      className={`btn btn--sm ${plugin.state === 'enabled' ? 'btn--danger' : 'btn--primary'}`}
                    >
                      {actionLoading === plugin.manifest.id ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          {plugin.state === 'enabled' ? 'Disabling...' : 'Enabling...'}
                        </>
                      ) : (
                        <>
                          <Power size={14} />
                          {plugin.state === 'enabled' ? 'Disable' : 'Enable'}
                        </>
                      )}
                    </button>

                    {plugin.hasUpdate && (
                      <button
                        onClick={() => handleUpdatePlugin(plugin)}
                        disabled={actionLoading === plugin.manifest.id}
                        className="btn btn--sm btn--success"
                      >
                        {actionLoading === plugin.manifest.id ? 'Updating...' : 'Update'}
                      </button>
                    )}

                    {plugin.manifest.license.type !== 'free' && (
                      <>
                        {!plugin.licenseInfo?.isActive ? (
                          <button
                            className="btn btn--sm btn--license"
                            onClick={() => setActiveModalPlugin(plugin)}
                          >
                            Activate License
                          </button>
                        ) : (
                          <button
                            className="btn btn--sm btn--secondary"
                            onClick={() => setDeactivatingLicensePlugin(plugin)}
                          >
                            Deactivate License
                          </button>
                        )}
                      </>
                    )}

                    {plugin.manifest.homepage && (
                      <a
                        href={plugin.manifest.homepage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn--sm btn--secondary"
                      >
                        Homepage
                      </a>
                    )}

                    {plugin.state === 'enabled' && (
                      <button
                        className="btn btn--icon btn--secondary"
                        onClick={() => handleReloadPlugin(plugin)}
                        disabled={actionLoading === plugin.manifest.id}
                        title="Reload Plugin"
                      >
                        <RotateCcw size={15} className={actionLoading === plugin.manifest.id ? 'animate-spin' : ''} />
                      </button>
                    )}

                    {plugin.manifest.configuration && (
                      <button
                        className="btn btn--icon btn--secondary"
                        onClick={() => setActiveSettingsPlugin(plugin)}
                        title="Settings"
                      >
                        <Settings size={15} />
                      </button>
                    )}

                    <button
                      className="btn btn--icon btn--secondary btn--danger-hover"
                      onClick={() => handleUninstallPlugin(plugin)}
                      disabled={actionLoading === plugin.manifest.id}
                      title="Uninstall Plugin"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeModalPlugin && (
        <LicenseActivationModal 
          plugin={activeModalPlugin} 
          onClose={() => setActiveModalPlugin(null)} 
        />
      )}

      {activeSettingsPlugin && (
        <PluginSettingsModal
          plugin={activeSettingsPlugin}
          onClose={() => setActiveSettingsPlugin(null)}
        />
      )}

      <ConfirmModal
        isOpen={!!uninstallingPlugin}
        onClose={() => setUninstallingPlugin(null)}
        onConfirm={confirmUninstall}
        title="Uninstall Plugin"
        message={uninstallingPlugin ? `Are you sure you want to uninstall ${uninstallingPlugin.manifest.name}? This will permanently delete all plugin files.` : ''}
        confirmLabel="Uninstall"
        variant="danger"
        loading={actionLoading === uninstallingPlugin?.manifest.id}
      />

      <ConfirmModal
        isOpen={!!updatingPlugin}
        onClose={() => setUpdatingPlugin(null)}
        onConfirm={confirmUpdate}
        title="Update Plugin"
        message={updatingPlugin ? `Update ${updatingPlugin.manifest.name} to v${updatingPlugin.latestVersion}?` : ''}
        confirmLabel="Update"
        variant="info"
        loading={actionLoading === updatingPlugin?.manifest.id}
      />

      <ConfirmModal
        isOpen={!!deactivatingLicensePlugin}
        onClose={() => setDeactivatingLicensePlugin(null)}
        onConfirm={() => {
          if (!deactivatingLicensePlugin) return;
          withAction(
            deactivatingLicensePlugin.manifest.id,
            async () => {
              await deactivateLicense(deactivatingLicensePlugin.manifest.id);
              setDeactivatingLicensePlugin(null);
            },
            'Failed to deactivate license'
          );
        }}
        title="Deactivate License"
        message={deactivatingLicensePlugin ? `Deactivate the license for ${deactivatingLicensePlugin.manifest.name}? You will need to re-enter your license key to use it again.` : ''}
        confirmLabel="Deactivate"
        variant="warning"
        loading={actionLoading === deactivatingLicensePlugin?.manifest.id}
      />
    </div>
  );
}
