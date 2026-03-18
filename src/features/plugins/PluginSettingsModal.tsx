/**
 * Plugin Settings Modal
 *
 * Generates a settings form based on the plugin's configuration schema.
 */

import { useState, useEffect } from 'react';
import { Settings, AlertTriangle } from 'lucide-react';
import type { Plugin } from '../../../electron/types/plugin-types';
import { usePlugins } from './PluginProvider';
import { PluginConfigurationForm } from '../../components/plugins/PluginConfigurationForm';
import { BaseModal } from '../../components/modals/BaseModal';


interface PluginSettingsModalProps {
  plugin: Plugin;
  onClose: () => void;
}

export function PluginSettingsModal({
  plugin,
  onClose,
}: PluginSettingsModalProps) {
  const { getSettings, saveSettings } = usePlugins();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const schema = plugin.manifest.configuration;

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const loaded = await getSettings(plugin.manifest.id);

        // Merge with defaults
        const defaults: Record<string, unknown> = {};
        if (schema?.properties) {
          Object.entries(schema.properties).forEach(
            ([key, prop]) => {
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

  const handleSave = async (values: Record<string, unknown>) => {
    setError(null);
    try {
      await saveSettings(plugin.manifest.id, values);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      throw err; // Re-throw to let form component handle it
    }
  };

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={`Settings: ${plugin.manifest.name}`}
      subtitle={schema?.title}
      icon={<Settings size={20} />}
      maxWidth="600px"
    >
      {!schema ? (
        <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
          This plugin has no configurable settings.
        </p>
      ) : (
        <>
          {error && (
            <div className="license-modal__alert license-modal__alert--error">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

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
        </>
      )}
    </BaseModal>
  );
}
