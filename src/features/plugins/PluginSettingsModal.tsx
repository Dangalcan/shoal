/**
 * Plugin Settings Modal
 * 
 * Generates a settings form based on the plugin's configuration schema.
 */

import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import type { Plugin } from '../../../electron/types/plugin-types';
import { usePlugins } from './PluginProvider';
import { PluginConfigurationForm } from '../../components/plugins/PluginConfigurationForm';


interface PluginSettingsModalProps {
  plugin: Plugin;
  onClose: () => void;
}

export function PluginSettingsModal({
  plugin,
  onClose,
}: PluginSettingsModalProps) {
  const { getSettings, saveSettings } = usePlugins();
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const schema = plugin.manifest.configuration;

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const loaded = await getSettings(plugin.manifest.id);

        // Merge with defaults
        const defaults: Record<string, any> = {};
        if (schema?.properties) {
          Object.entries(schema.properties).forEach(
            ([key, prop]: [string, any]) => {
              if (prop.default !== undefined) {
                defaults[key] = prop.default;
              }
            }
          );
        }

        setSettings({ ...defaults, ...loaded });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    if (schema) {
      loadSettings();
    }
  }, [plugin.manifest.id, schema]);

  const handleSave = async (values: Record<string, any>) => {
    setError(null);
    try {
      await saveSettings(plugin.manifest.id, values);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      throw err; // Re-throw to let form component handle it
    }
  };

  if (!schema) {
    return (
      <div className="modal-overlay">
        <div className="license-modal" style={{ maxWidth: '600px' }}>
          <button className="license-modal__close" onClick={onClose}>
            <X size={20} />
          </button>
          <div className="license-modal__header" style={{ textAlign: 'left', marginBottom: '1rem' }}>
            <h2 className="license-modal__title">Settings: {plugin.manifest.name}</h2>
          </div>
          <div className="license-modal__body" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
            This plugin has no configurable settings.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="license-modal" style={{ maxWidth: '600px' }}>
        <button className="license-modal__close" onClick={onClose}>
          <X size={20} />
        </button>

        <div
          className="license-modal__header"
          style={{ textAlign: 'left', marginBottom: '1rem' }}
        >
          <h2 className="license-modal__title">
            Settings: {plugin.manifest.name}
          </h2>
          {schema.title && (
            <p className="license-modal__subtitle">{schema.title}</p>
          )}
        </div>

        {error && (
          <div className="license-modal__alert license-modal__alert--error">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="license-modal__body">
          {loading ? (
            <div className="plugins__loading">
              <div className="spinner"></div>
            </div>
          ) : (
            <PluginConfigurationForm
              schema={schema}
              initialValues={settings}
              onSave={handleSave}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

