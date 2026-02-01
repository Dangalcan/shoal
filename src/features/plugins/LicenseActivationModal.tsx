/**
 * License Activation Modal
 * 
 * Allows users to activate a license or start a trial for a plugin.
 */

import { useState } from 'react';
import { X, Key, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import type { Plugin } from '../../../electron/types/plugin-types';
import { usePlugins } from './PluginProvider';
import '../../../styles/components/plugins/LicenseActivationModal.css';

interface LicenseActivationModalProps {
  plugin: Plugin;
  onClose: () => void;
}

export function LicenseActivationModal({ plugin, onClose }: LicenseActivationModalProps) {
  const { activateLicense, startTrial } = usePlugins();
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const pricing = plugin.manifest.license.pricing;
  const trialAvailable = pricing?.trialDays && !plugin.licenseInfo?.trialEndsAt;

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await activateLicense(plugin.manifest.id, licenseKey.trim());
      setSuccess('License activated successfully!');
      setTimeout(onClose, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to activate license');
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
    } catch (err: any) {
      setError(err.message || 'Failed to start trial');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="license-modal">
        <button className="license-modal__close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="license-modal__header">
          <Key className="license-modal__icon" size={32} />
          <h2 className="license-modal__title">Activate {plugin.manifest.name}</h2>
          <p className="license-modal__subtitle">
            Enter your license key to unlock this plugin.
          </p>
        </div>

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
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="PRO-XXXX-XXXX-XXXX"
              className="form-input"
              disabled={loading || !!success}
            />
          </div>

          <div className="license-modal__actions">
            <button
              type="submit"
              className="btn btn--primary btn--full"
              disabled={loading || !licenseKey.trim() || !!success}
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
        
        <div className="license-modal__footer">
          <p>
            Don't have a license?{' '}
            <a href={plugin.manifest.homepage} target="_blank" rel="noopener noreferrer">
              Purchase one here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
