/**
 * Plugin Settings Modal
 * 
 * Generates a settings form based on the plugin's configuration schema.
 */

import { useState, useEffect } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import type { Plugin, PluginConfigurationSchema } from '../../../electron/types/plugin-types';
import { usePlugins } from './PluginProvider';
import '../../../styles/components/plugins/LicenseActivationModal.css';

interface PluginSettingsModalProps {
  plugin: Plugin;
  onClose: () => void;
}

export function PluginSettingsModal({ plugin, onClose }: PluginSettingsModalProps) {
  const { getSettings, saveSettings } = usePlugins();
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
          Object.entries(schema.properties).forEach(([key, prop]: [string, any]) => {
             if (prop.default !== undefined) {
               defaults[key] = prop.default;
             }
          });
        }
        
        setSettings({ ...defaults, ...loaded });
      } catch (err: any) {
        setError(err.message || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [plugin.manifest.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveSettings(plugin.manifest.id, settings);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (!schema) return null;

  return (
    <div className="modal-overlay">
      <div className="license-modal" style={{ maxWidth: '600px' }}>
        <button className="license-modal__close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="license-modal__header" style={{ textAlign: 'left', marginBottom: '1rem' }}>
          <h2 className="license-modal__title">Settings: {plugin.manifest.name}</h2>
          {schema.title && <p className="license-modal__subtitle">{schema.title}</p>}
        </div>

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
          <form onSubmit={handleSave} className="license-modal__form">
            {Object.entries(schema.properties).map(([key, prop]: [string, any]) => (
              <div key={key} className="form-group">
                <label htmlFor={key}>{prop.label}</label>
                
                {prop.type === 'boolean' ? (
                  <div className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      id={key}
                      checked={!!settings[key]}
                      onChange={(e) => handleChange(key, e.target.checked)}
                    />
                    <span className="checkbox-label">Enable</span>
                  </div>
                ) : prop.enum ? (
                   <select
                     id={key}
                     value={settings[key] || ''}
                     onChange={(e) => handleChange(key, e.target.value)}
                     className="form-input"
                   >
                     {prop.enum.map((opt: any) => (
                       <option key={opt} value={opt}>{opt}</option>
                     ))}
                   </select>
                ) : prop.multiline ? (
                   <textarea
                     id={key}
                     value={settings[key] || ''}
                     onChange={(e) => handleChange(key, e.target.value)}
                     className="form-input"
                     rows={3}
                   />
                ) : (
                  <input
                    type={prop.type === 'number' ? 'number' : (prop.secret ? 'password' : 'text')}
                    id={key}
                    value={settings[key] || ''}
                    onChange={(e) => handleChange(key, prop.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                    className="form-input"
                  />
                )}
                
                {prop.description && (
                  <p className="form-help-text">{prop.description}</p>
                )}
              </div>
            ))}

            <div className="license-modal__actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={saving}
              >
                {saving ? (
                   <><span className="spinner spinner--small"></span> Saving...</>
                ) : (
                   <><Save size={16} /> Save Settings</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
