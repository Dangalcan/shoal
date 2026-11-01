/**
 * Plugin Settings Modal
 *
 * Generates a settings form based on the plugin's configuration schema.
 */

import { useState, useEffect, useRef } from 'react';
import { Settings, AlertTriangle } from 'lucide-react';
import type { Plugin } from '../../../electron/types/plugin-types';
import { usePlugins } from './PluginProvider';
import { PluginConfigurationForm } from '../../components/plugins/PluginConfigurationForm';
import { BaseModal } from '../../components/modals/BaseModal';

interface PluginSettingsModalProps {
  plugin: Plugin;
  onClose: () => void;
}

export function PluginSettingsModal(props: PluginSettingsModalProps) {
  // Keyed on the plugin: another plugin gets a fresh, loading dialog
  // instead of a form that still shows the previous values.
  return <PluginSettingsDialog key={props.plugin.manifest.id} {...props} />;
}

function PluginSettingsDialog({ plugin, onClose }: PluginSettingsModalProps) {
  const { getSettings, saveSettings } = usePlugins();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // A configuration without properties (plugin.json is not validated against
  // the schema type) has nothing to set: same as no configuration at all.
  const configuration = plugin.manifest.configuration;
  const schema =
    configuration && Object.keys(configuration.properties ?? {}).length > 0
      ? configuration
      : undefined;

  // The context hands out a new `getSettings` on every render; the ref keeps
  // the effect below from reloading each time.
  const getSettingsRef = useRef(getSettings);
  useEffect(() => {
    getSettingsRef.current = getSettings;
  });

  useEffect(() => {
    if (!schema) return;
    let cancelled = false;
    const loadSettings = async () => {
      try {
        const loaded = await getSettingsRef.current(plugin.manifest.id);
        if (cancelled) return;

        // Merge with defaults
        const defaults: Record<string, unknown> = {};
        Object.entries(schema.properties).forEach(([key, prop]) => {
          if (prop.default !== undefined) {
            defaults[key] = prop.default;
          }
        });

        setSettings({ ...defaults, ...loaded });
      } catch (err: unknown) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load settings'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadSettings();
    return () => {
      cancelled = true;
    };
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
        <p
          style={{
            textAlign: 'center',
            padding: '2rem',
            color: 'var(--color-text-muted)',
          }}
        >
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
