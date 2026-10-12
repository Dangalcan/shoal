/**
 * Plugin card component for the Plugins page
 */

import {
  Settings,
  RotateCcw,
  Trash2,
  Power,
  AlertCircle,
  User,
  Shield,
  Loader2,
} from 'lucide-react';
import type { Plugin } from '../../../electron/types/plugin-types';

const PLUGIN_STATE_MAP: Record<string, { label: string; className: string }> = {
  enabled: { label: 'Enabled', className: 'plugin-state--enabled' },
  disabled: { label: 'Disabled', className: 'plugin-state--disabled' },
  error: { label: 'Error', className: 'plugin-state--error' },
  loading: { label: 'Loading...', className: 'plugin-state--loading' },
};

export function getPluginStateClass(state: string): string {
  return PLUGIN_STATE_MAP[state]?.className ?? '';
}

export function getPluginStateLabel(state: string): string {
  return PLUGIN_STATE_MAP[state]?.label ?? state;
}

interface PluginCardProps {
  plugin: Plugin;
  actionLoading: string | null;
  onToggle: (plugin: Plugin) => void;
  onUpdate: (plugin: Plugin) => void;
  onOpenLicense: (plugin: Plugin) => void;
  onDeactivateLicense: (plugin: Plugin) => void;
  onReload: (plugin: Plugin) => void;
  onOpenSettings: (plugin: Plugin) => void;
  onUninstall: (plugin: Plugin) => void;
}

export function PluginCard({
  plugin,
  actionLoading,
  onToggle,
  onUpdate,
  onOpenLicense,
  onDeactivateLicense,
  onReload,
  onOpenSettings,
  onUninstall,
}: PluginCardProps) {
  const isLoading = actionLoading === plugin.manifest.id;

  return (
    <div className="plugin-card">
      <div className="plugin-card__header">
        <div className="plugin-card__info">
          <div className="plugin-card__title-row">
            <h3 className="plugin-card__name">{plugin.manifest.name}</h3>
            {plugin.hasUpdate && (
              <span
                className="plugin-update-badge"
                title={`Update available: v${plugin.latestVersion}`}
              >
                Update Available
              </span>
            )}
          </div>
          <p className="plugin-card__version">
            v{plugin.manifest.version}
            {plugin.hasUpdate && (
              <span className="latest-version">
                {' '}
                (Latest: v{plugin.latestVersion})
              </span>
            )}
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
          <span className="plugin-card__meta-value">
            {plugin.manifest.author}
          </span>
        </div>
        <div className="plugin-card__meta-item">
          <span className="plugin-card__meta-label">
            <Shield
              size={14}
              style={{ display: 'inline', marginRight: '4px' }}
            />
            License:
          </span>
          <span className="plugin-card__meta-value">
            {plugin.manifest.license.type === 'free'
              ? plugin.manifest.license.spdx
              : `${plugin.manifest.license.type} (${plugin.manifest.license.spdx})`}
          </span>
        </div>
        {plugin.manifest.permissions &&
          plugin.manifest.permissions.length > 0 && (
            <div className="plugin-card__meta-item">
              <span className="plugin-card__meta-label">
                <AlertCircle
                  size={14}
                  style={{ display: 'inline', marginRight: '4px' }}
                />
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
          onClick={() => onToggle(plugin)}
          disabled={isLoading || plugin.state === 'loading'}
          className={`btn btn--sm ${plugin.state === 'enabled' ? 'btn--danger' : 'btn--primary'}`}
        >
          {isLoading ? (
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
            onClick={() => onUpdate(plugin)}
            disabled={isLoading}
            className="btn btn--sm btn--success"
          >
            {isLoading ? 'Updating...' : 'Update'}
          </button>
        )}

        {plugin.manifest.license.type !== 'free' && (
          <>
            {!plugin.licenseInfo?.isActive ? (
              <button
                className="btn btn--sm btn--license"
                onClick={() => onOpenLicense(plugin)}
              >
                Activate License
              </button>
            ) : (
              <button
                className="btn btn--sm btn--secondary"
                onClick={() => onDeactivateLicense(plugin)}
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
            onClick={() => onReload(plugin)}
            disabled={isLoading}
            title="Reload Plugin"
          >
            <RotateCcw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
        )}

        {plugin.manifest.configuration && (
          <button
            className="btn btn--icon btn--secondary"
            onClick={() => onOpenSettings(plugin)}
            title="Settings"
          >
            <Settings size={15} />
          </button>
        )}

        {!plugin.bundled && (
          <button
            className="btn btn--icon btn--secondary btn--danger-hover"
            onClick={() => onUninstall(plugin)}
            disabled={isLoading}
            title="Uninstall Plugin"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
