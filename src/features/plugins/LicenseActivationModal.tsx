/**
 * License Activation Modal
 *
 * Allows users to activate a license or start a trial for a plugin.
 */

import { useState } from 'react';
import { Key, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import type { Plugin } from '../../../electron/types/plugin-types';
import { usePlugins } from './PluginProvider';
import { BaseModal } from '../../components/modals/BaseModal';

interface LicenseActivationModalProps {
  plugin: Plugin;
  onClose: () => void;
}

const LICENSE_KEY_RE = /^[A-Z]{2,10}-[A-Z0-9]{4,}(-[A-Z0-9]{4,})+$/;

export function LicenseActivationModal({
  plugin,
  onClose,
}: LicenseActivationModalProps) {
  const { activateLicense, startTrial } = usePlugins();
  const [licenseKey, setLicenseKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const pricing = plugin.manifest.license.pricing;
  const trialAvailable = pricing?.trialDays && !plugin.licenseInfo?.trialEndsAt;
  const keyValid = LICENSE_KEY_RE.test(licenseKey);
  const showKeyError = keyTouched && licenseKey.length > 0 && !keyValid;

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyValid) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await activateLicense(plugin.manifest.id, licenseKey.trim());
      setSuccess('License activated successfully!');
      setTimeout(onClose, 2000);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to activate license'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrial = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await startTrial(plugin.manifest.id);
      setSuccess(`Trial started! You have ${pricing?.trialDays} days.`);
      setTimeout(onClose, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start trial');
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <p className="license-modal__footer-text">
      Don't have a license?{' '}
      <a
        href={plugin.manifest.homepage ?? 'https://shoal.dangalcan.com'}
        target="_blank"
        rel="noopener noreferrer"
      >
        Purchase one here
      </a>
    </p>
  );

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={`Activate ${plugin.manifest.name}`}
      subtitle="Enter your license key to unlock this plugin."
      icon={<Key size={20} />}
      maxWidth="480px"
      footer={footer}
    >
      {error && (
        <div className="license-modal__alert license-modal__alert--error">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="license-modal__alert license-modal__alert--success">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleActivate} className="license-modal__form">
        <div className="form-group">
          <label htmlFor="licenseKey">License Key</label>
          <input
            type="text"
            id="licenseKey"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
            onBlur={() => setKeyTouched(true)}
            placeholder="PRO-XXXX-XXXX-XXXX"
            className={`form-input${showKeyError ? ' form-input--error' : ''}`}
            disabled={loading || !!success}
            autoComplete="off"
            spellCheck={false}
          />
          {showKeyError && (
            <p className="form-hint form-hint--error">
              Format: PREFIX-XXXX-XXXX (e.g. PRO-AB12-CD34-EF56)
            </p>
          )}
          {!showKeyError && licenseKey.length === 0 && (
            <p className="form-hint">
              Enter the key exactly as received (case-insensitive)
            </p>
          )}
        </div>

        <div className="license-modal__actions">
          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading || !keyValid || !!success}
          >
            {loading ? 'Activating...' : 'Activate License'}
          </button>
        </div>
      </form>

      {plugin.manifest.license.type === 'paid' && pricing && (
        <div className="license-modal__pricing">
          <div className="pricing-item">
            <span className="pricing-label">Price:</span>
            <span className="pricing-value">
              {pricing.currency} {pricing.price}
              {pricing.interval ? ` / ${pricing.interval}` : ' (One-time)'}
            </span>
          </div>
        </div>
      )}

      {trialAvailable && !success && (
        <div className="license-modal__trial">
          <div className="divider">
            <span>OR</span>
          </div>
          <button
            onClick={handleStartTrial}
            disabled={loading}
            className="btn btn--secondary btn--full btn--icon"
          >
            <Clock size={16} />
            Start {pricing?.trialDays}-Day Free Trial
          </button>
        </div>
      )}
    </BaseModal>
  );
}
