/**
 * Plugins Management Page
 *
 * Allows users to view, enable, disable, and manage installed plugins.
 */

import { useState } from 'react';
import { usePlugins } from '../features/plugins/PluginProvider';
import { handleAsyncOperation } from '../lib/async-operation-handler';
import { useItemModal } from '../hooks/useItemModal';
import { PluginCard } from '../features/plugins/PluginCard';
import { LicenseActivationModal } from '../features/plugins/LicenseActivationModal';
import { MarketplaceList } from '../features/marketplace/MarketplaceList';
import { useFeatureFlags } from '../features/plugins/useFeatureFlags';
import { PluginSettingsModal } from '../features/plugins/PluginSettingsModal';
import { ConfirmModal } from '../components/modals/ConfirmModal';
import { Package, Download, Upload, Loader2 } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'installed' | 'marketplace'>('installed');
  const { flags } = useFeatureFlags();
  const showMarketplace = flags.marketplace && activeTab === 'marketplace';
  const [importing, setImporting] = useState(false);
  const licenseModal = useItemModal<Plugin>();
  const settingsModal = useItemModal<Plugin>();
  const uninstallModal = useItemModal<Plugin>();
  const updateModal = useItemModal<Plugin>();
  const deactivateLicenseModal = useItemModal<Plugin>();

  // Shared wrapper: manages per-plugin loading state around handleAsyncOperation
  const withAction = async (
    pluginId: string,
    fn: () => Promise<void>,
    loadingMessage: string,
    successMessage: string,
    errorTitle: string,
  ) => {
    setActionLoading(pluginId);
    try {
      await handleAsyncOperation(
        async () => { await fn(); return { success: true as const, data: undefined }; },
        { loadingMessage, successMessage, errorTitle }
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleTogglePlugin = (plugin: Plugin) => {
    const isEnabled = plugin.state === 'enabled';
    return withAction(
      plugin.manifest.id,
      () => isEnabled ? disablePlugin(plugin.manifest.id) : enablePlugin(plugin.manifest.id),
      isEnabled ? 'Disabling plugin...' : 'Enabling plugin...',
      isEnabled ? 'Plugin disabled.' : 'Plugin enabled.',
      isEnabled ? 'Failed to disable plugin' : 'Failed to enable plugin',
    );
  };

  const handleReloadPlugin = (plugin: Plugin) =>
    withAction(
      plugin.manifest.id,
      () => reloadPlugin(plugin.manifest.id),
      'Reloading plugin...',
      'Plugin reloaded.',
      'Failed to reload plugin',
    );

  const handleUpdatePlugin = (plugin: Plugin) => updateModal.open(plugin);

  const confirmUpdate = () => {
    const plugin = updateModal.item;
    if (!plugin) return;
    withAction(
      plugin.manifest.id,
      async () => {
        await installPlugin(plugin.manifest.id);
        updateModal.close();
      },
      `Updating ${plugin.manifest.name}...`,
      'Plugin updated successfully.',
      'Failed to update plugin',
    );
  };

  const handleImportPlugin = async () => {
    setImporting(true);
    await handleAsyncOperation(
      async () => { await importLocalPlugin(); return { success: true as const, data: undefined }; },
      { loadingMessage: 'Importing plugin...', successMessage: 'Plugin imported.', errorTitle: 'Failed to import plugin' }
    );
    setImporting(false);
  };

  const handleUninstallPlugin = (plugin: Plugin) => uninstallModal.open(plugin);

  const confirmUninstall = () => {
    const plugin = uninstallModal.item;
    if (!plugin) return;
    withAction(
      plugin.manifest.id,
      async () => {
        if (plugin.state === 'enabled') {
          await disablePlugin(plugin.manifest.id);
        }
        await uninstallPlugin(plugin.manifest.id);
        uninstallModal.close();
      },
      `Uninstalling ${plugin.manifest.name}...`,
      'Plugin uninstalled.',
      'Failed to uninstall plugin',
    );
  };

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
           <p className="plugins__subtitle">
             {flags.marketplace
               ? 'Manage your installed plugins or discover new ones.'
               : 'Manage your installed plugins.'}
           </p>
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

      {flags.marketplace && (
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
      )}

      {showMarketplace ? (
        <MarketplaceList />
      ) : (
        <>
          {plugins.length === 0 ? (
            <div className="plugins__empty">
              <p>No plugins installed.</p>
              <p className="plugins__empty-hint">
                {flags.marketplace
                  ? 'Check out the Marketplace to find plugins!'
                  : 'The plugin marketplace arrives with Shoal 1.0.'}
              </p>
            </div>
          ) : (
            <div className="plugins__list">
              {plugins.map((plugin) => (
                <PluginCard
                  key={plugin.manifest.id}
                  plugin={plugin}
                  actionLoading={actionLoading}
                  onToggle={handleTogglePlugin}
                  onUpdate={handleUpdatePlugin}
                  onOpenLicense={licenseModal.open}
                  onDeactivateLicense={deactivateLicenseModal.open}
                  onReload={handleReloadPlugin}
                  onOpenSettings={settingsModal.open}
                  onUninstall={handleUninstallPlugin}
                />
              ))}
            </div>
          )}
        </>
      )}

      {licenseModal.item && (
        <LicenseActivationModal
          plugin={licenseModal.item}
          onClose={licenseModal.close}
        />
      )}

      {settingsModal.item && (
        <PluginSettingsModal
          plugin={settingsModal.item}
          onClose={settingsModal.close}
        />
      )}

      <ConfirmModal
        isOpen={uninstallModal.isOpen}
        onClose={uninstallModal.close}
        onConfirm={confirmUninstall}
        title="Uninstall Plugin"
        message={uninstallModal.item ? `Are you sure you want to uninstall ${uninstallModal.item.manifest.name}? This will permanently delete all plugin files.` : ''}
        confirmLabel="Uninstall"
        variant="danger"
        loading={actionLoading === uninstallModal.item?.manifest.id}
      />

      <ConfirmModal
        isOpen={updateModal.isOpen}
        onClose={updateModal.close}
        onConfirm={confirmUpdate}
        title="Update Plugin"
        message={updateModal.item ? `Update ${updateModal.item.manifest.name} to v${updateModal.item.latestVersion}?` : ''}
        confirmLabel="Update"
        variant="info"
        loading={actionLoading === updateModal.item?.manifest.id}
      />

      <ConfirmModal
        isOpen={deactivateLicenseModal.isOpen}
        onClose={deactivateLicenseModal.close}
        onConfirm={() => {
          const plugin = deactivateLicenseModal.item;
          if (!plugin) return;
          withAction(
            plugin.manifest.id,
            async () => {
              await deactivateLicense(plugin.manifest.id);
              deactivateLicenseModal.close();
            },
            'Deactivating license...',
            'License deactivated.',
            'Failed to deactivate license',
          );
        }}
        title="Deactivate License"
        message={deactivateLicenseModal.item ? `Deactivate the license for ${deactivateLicenseModal.item.manifest.name}? You will need to re-enter your license key to use it again.` : ''}
        confirmLabel="Deactivate"
        variant="warning"
        loading={actionLoading === deactivateLicenseModal.item?.manifest.id}
      />
    </div>
  );
}
