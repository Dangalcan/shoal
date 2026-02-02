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
import { Settings, RotateCcw, Package, Download, Trash2, Power, AlertCircle, User, Shield, Upload } from 'lucide-react';
import type { Plugin } from '../../electron/types/plugin-types';
import '../../styles/pages/Plugins.css';

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
  const [importing, setImporting] = useState(false);

  const handleTogglePlugin = async (plugin: Plugin) => {
    setActionLoading(plugin.manifest.id);
    setActionError(null);

    try {
      if (plugin.state === 'enabled') {
        await disablePlugin(plugin.manifest.id);
      } else {
        await enablePlugin(plugin.manifest.id);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to toggle plugin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReloadPlugin = async (plugin: Plugin) => {
    setActionLoading(plugin.manifest.id);
    setActionError(null);
    try {
      await reloadPlugin(plugin.manifest.id);
    } catch (err: any) {
      setActionError(err.message || 'Failed to reload plugin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdatePlugin = async (plugin: Plugin) => {
    if (!confirm(`Update ${plugin.manifest.name} to v${plugin.latestVersion}?`)) return;

    setActionLoading(plugin.manifest.id);
    setActionError(null);
    try {
      await installPlugin(plugin.manifest.id);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update plugin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleImportPlugin = async () => {
    setImporting(true);
    setActionError(null);
    try {
      await importLocalPlugin();
    } catch (err: any) {
      setActionError(err.message || 'Failed to import plugin');
    } finally {
      setImporting(false);
    }
  };

  const handleUninstallPlugin = (plugin: Plugin) => {
    setUninstallingPlugin(plugin);
  };

  const confirmUninstall = async () => {
    if (!uninstallingPlugin) return;

    setActionLoading(uninstallingPlugin.manifest.id);
    setActionError(null);
    try {
      await uninstallPlugin(uninstallingPlugin.manifest.id);
      setUninstallingPlugin(null);
    } catch (err: any) {
      setActionError(err.message || 'Failed to uninstall plugin');
    } finally {
      setActionLoading(null);
    }
  };

  const getPluginStateClass = (state: string) => {
    switch (state) {
      case 'enabled':
        return 'plugin-state--enabled';
      case 'disabled':
        return 'plugin-state--disabled';
      case 'error':
        return 'plugin-state--error';
      case 'loading':
        return 'plugin-state--loading';
      default:
        return '';
    }
  };

  const getPluginStateLabel = (state: string) => {
    switch (state) {
      case 'enabled':
        return 'Enabled';
      case 'disabled':
        return 'Disabled';
      case 'error':
        return 'Error';
      case 'loading':
        return 'Loading...';
      default:
        return state;
    }
  };

  if (loading) {
    return (
      <div className="plugins">
        <div className="plugins__header">
          <h1 className="plugins__title">Plugins</h1>
        </div>
        <div className="plugins__loading">
          <div className="spinner"></div>
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
      <div className="plugins__header">
        <div className="plugins-header">
           <h1>Plugins</h1>
           <p>Manage your installed plugins or discover new ones.</p>
        </div>

        <div className="plugins-actions">
           <button
             className="btn btn--secondary"
             onClick={handleImportPlugin}
             disabled={importing}
           >
             {importing ? (
               <span className="spinner spinner--small"></span>
             ) : (
               <Upload size={16} style={{ marginRight: '8px' }} />
             )}
             Load Unpacked Plugin
           </button>
        </div>

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
                      className={`btn ${plugin.state === 'enabled' ? 'btn--danger' : 'btn--primary'}`}
                    >
                      {actionLoading === plugin.manifest.id ? (
                        <>
                          <span className="spinner spinner--small"></span>
                          {plugin.state === 'enabled' ? 'Disabling...' : 'Enabling...'}
                        </>
                      ) : (
                        <>
                          <Power size={16} />
                          {plugin.state === 'enabled' ? 'Disable' : 'Enable'}
                        </>
                      )}
                    </button>

                    {plugin.hasUpdate && (
                      <button
                        onClick={() => handleUpdatePlugin(plugin)}
                        disabled={actionLoading === plugin.manifest.id}
                        className="btn btn--success"
                      >
                        {actionLoading === plugin.manifest.id ? 'Updating...' : 'Update'}
                      </button>
                    )}

                    {plugin.manifest.license.type !== 'free' && (
                      <>
                        {!plugin.licenseInfo?.isActive ? (
                          <button 
                            className="btn btn--secondary"
                            onClick={() => setActiveModalPlugin(plugin)}
                          >
                            Activate License
                          </button>
                        ) : (
                          <button 
                            className="btn btn--secondary"
                            onClick={async () => {
                              if (confirm('Are you sure you want to deactivate this license?')) {
                                await deactivateLicense(plugin.manifest.id);
                              }
                            }}
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
                        className="btn btn--secondary"
                      >
                        Homepage
                      </a>
                    )}

                    {plugin.state === 'enabled' && (
                      <button
                        className="btn btn--secondary btn--icon"
                        onClick={() => handleReloadPlugin(plugin)}
                        disabled={actionLoading === plugin.manifest.id}
                        title="Reload Plugin"
                      >
                        <RotateCcw size={16} className={actionLoading === plugin.manifest.id ? 'spin' : ''} />
                      </button>
                    )}
                    
                    {plugin.manifest.configuration && (
                      <button
                        className="btn btn--secondary btn--icon"
                        onClick={() => setActiveSettingsPlugin(plugin)}
                        title="Settings"
                      >
                        <Settings size={16} />
                      </button>
                    )}

                    {plugin.state !== 'enabled' && (
                      <button
                        className="btn btn--secondary btn--icon btn--danger-hover"
                        onClick={() => handleUninstallPlugin(plugin)}
                        disabled={actionLoading === plugin.manifest.id}
                        title="Uninstall Plugin"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
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
    </div>
  );
}
