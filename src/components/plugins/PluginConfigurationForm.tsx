/**
 * Plugin Configuration Form
 *
 * Auto-generates a configuration form from plugin manifest schema.
 * Similar to Odoo's automatic settings UI generation.
 */

import React, { useState } from 'react';
import type {
  PluginConfigurationSchema,
  PluginConfigProperty,
} from '../../../electron/types/plugin-types';
import '../../../styles/components/plugins/PluginConfigurationForm.css';

interface Props {
  schema: PluginConfigurationSchema;
  initialValues: Record<string, any>;
  onSave: (values: Record<string, any>) => Promise<void>;
  onCancel: () => void;
}

export function PluginConfigurationForm({
  schema,
  initialValues,
  onSave,
  onCancel,
}: Props) {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validateField = (
    key: string,
    value: any,
    property: PluginConfigProperty
  ): string | null => {
    // Required validation
    if (
      property.required &&
      (value === undefined || value === null || value === '')
    ) {
      return `${property.label} is required`;
    }

    // Type validation
    if (value !== undefined && value !== null) {
      if (property.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) return `${property.label} must be a number`;
        if (property.min !== undefined && num < property.min) {
          return `${property.label} must be at least ${property.min}`;
        }
        if (property.max !== undefined && num > property.max) {
          return `${property.label} must be at most ${property.max}`;
        }
      }

    // Pattern validation (moved inside array check if needed)
    if (property.validation?.pattern && typeof value === 'string') {
      const regex = new RegExp(property.validation.pattern);
      if (!regex.test(value)) {
        return (
          property.validation.message || `${property.label} format is invalid`
        );
      }
    }

      // Array validation
      if (property.type === 'array' && Array.isArray(value)) {
        if (property.required && value.length === 0) {
          return `${property.label} must have at least one item`;
        }
      }
    }

    return null;
  };

  const handleChange = (
    key: string,
    value: any,
    property: PluginConfigProperty
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));

    // Clear error for this field
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[key];
      return newErrors;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const newErrors: Record<string, string> = {};
    for (const [key, property] of Object.entries(schema.properties)) {
      const error = validateField(key, values[key], property);
      if (error) newErrors[key] = error;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Save
    setSaving(true);
    try {
      await onSave(values);
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      setErrors({ _form: error.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const renderField = (key: string, property: PluginConfigProperty) => {
    const value = values[key] ?? property.default;
    const error = errors[key];

    switch (property.type) {
      case 'string':
        if (property.multiline) {
          return (
            <textarea
              value={value || ''}
              onChange={(e) => handleChange(key, e.target.value, property)}
              placeholder={property.placeholder}
              className="config-textarea"
              rows={4}
            />
          );
        }
        return (
          <input
            type={property.secret ? 'password' : 'text'}
            value={value || ''}
            onChange={(e) => handleChange(key, e.target.value, property)}
            placeholder={property.placeholder}
            className="config-input"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => handleChange(key, e.target.valueAsNumber, property)}
            min={property.min}
            max={property.max}
            placeholder={property.placeholder}
            className="config-input"
          />
        );

      case 'boolean':
        return (
          <label className="config-checkbox">
            <input
              type="checkbox"
              checked={value ?? false}
              onChange={(e) => handleChange(key, e.target.checked, property)}
            />
            <span>{property.label}</span>
          </label>
        );

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => handleChange(key, e.target.value, property)}
            className="config-select"
          >
            <option value="">Select...</option>
            {property.enum?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'array':
        const items = Array.isArray(value) ? value : [];
        return (
          <div className="config-array">
            {items.map((item, index) => (
              <div key={index} className="config-array-item">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[index] = e.target.value;
                    handleChange(key, newItems, property);
                  }}
                  className="config-input"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newItems = items.filter((_, i) => i !== index);
                    handleChange(key, newItems, property);
                  }}
                  className="config-array-remove"
                >
                  &times;
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                handleChange(key, [...items, ''], property);
              }}
              className="config-array-add"
            >
              + Add Item
            </button>
          </div>
        );


      default:
        return <div>Unsupported field type: {property.type}</div>;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="plugin-config-form">
      <h3>{schema.title || 'Plugin Settings'}</h3>

      {errors._form && <div className="config-form-error">{errors._form}</div>}

      {Object.entries(schema.properties).map(([key, property]) => (
        <div key={key} className="config-field">
          {property.type !== 'boolean' && (
            <label className="config-label">
              {property.label}
              {property.required && <span className="required">*</span>}
            </label>
          )}

          {property.description && (
            <p className="config-description">{property.description}</p>
          )}

          {renderField(key, property)}

          {errors[key] && <span className="config-error">{errors[key]}</span>}
        </div>
      ))}

      <div className="config-actions">
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className="primary">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
