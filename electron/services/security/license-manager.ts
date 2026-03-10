/**
 * License Manager
 *
 * Handles plugin licensing, activation, validation, and trial management.
 * Persists license data via PluginRegistry.
 */

import { randomUUID } from 'crypto';
import { machineIdSync } from 'node-machine-id';
import { pluginRegistry } from '../plugins/plugin-registry';
import type { PluginLicenseInfo } from '../../types/plugin-types';

export interface LicenseValidationResult {
  valid: boolean;
  error?: string;
  licenseInfo?: PluginLicenseInfo;
}

const LICENSE_TOKEN_PREFIX = 'OFFLINE-ACTIVATED-';

const TRIAL_DURATION_DAYS = 14;
const GRACE_PERIOD_DAYS = 7;
const REVERIFICATION_INTERVAL_HOURS = 24;

export class LicenseManager {
  /**
   * Check if a plugin has a valid license to run.
   */
  checkLicense(pluginId: string): LicenseValidationResult {
    const plugin = pluginRegistry.getPlugin(pluginId)?.plugin;
    if (!plugin) {
      return { valid: false, error: 'Plugin not found' };
    }

    const licenseType = plugin.manifest.license.type;

    // Free plugins are always valid
    if (licenseType === 'free') {
      return { valid: true };
    }

    // Check saved license info
    const licenseInfo = plugin.licenseInfo;

    if (!licenseInfo) {
      return { valid: false, error: 'No license found' };
    }

    // Check trial
    if (licenseInfo.isTrialActive) {
      if (!licenseInfo.trialEndsAt) {
        return { valid: false, error: 'Invalid trial license' };
      }

      const trialEnd = new Date(licenseInfo.trialEndsAt);
      if (new Date() > trialEnd) {
        return { valid: false, error: 'Trial expired' };
      }

      return { valid: true };
    }

    // Check active license
    if (!licenseInfo.isActive) {
      return { valid: false, error: 'License is not active' };
    }

    // Check expiration (if applicable)
    if (licenseInfo.expiresAt) {
      const expiration = new Date(licenseInfo.expiresAt);
      if (new Date() > expiration) {
        return { valid: false, error: 'License expired' };
      }
    }

    // --- Offline Grace Period Logic ---
    const lastVerified = licenseInfo.lastVerifiedAt
      ? new Date(licenseInfo.lastVerifiedAt)
      : new Date(licenseInfo.activatedAt || 0);
    const now = new Date();

    const hoursSinceVerification =
      (now.getTime() - lastVerified.getTime()) / (1000 * 60 * 60);

    if (hoursSinceVerification > REVERIFICATION_INTERVAL_HOURS) {
      const daysSinceVerification = hoursSinceVerification / 24;
      if (daysSinceVerification > GRACE_PERIOD_DAYS) {
        return {
          valid: false,
          error: 'License verification required (offline for too long)',
        };
      }
      console.log(
        `[LicenseManager] Plugin ${pluginId} in grace period (${daysSinceVerification.toFixed(1)} days since last verification)`
      );
    }

    return { valid: true };
  }

  /**
   * Activate a license key for a plugin via backend.
   */
  /**
   * Activate a license key for a plugin (Offline Simulation).
   */
  async activateLicense(
    pluginId: string,
    licenseKey: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const mId = machineIdSync();
      console.log(
        `[LicenseManager] Activating license for ${pluginId} with key ${licenseKey}...`
      );

      if (!licenseKey || licenseKey.length < 5) {
        throw new Error('Invalid license key format');
      }

      const backendUrl = process.env.MARKETPLACE_BACKEND_URL;
      let activationToken: string;
      let isTrialActive = licenseKey === 'TRIAL-REQUEST';

      if (backendUrl) {
        // Real backend activation
        const response = await fetch(`${backendUrl}/licenses/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pluginId, machineId: mId, licenseKey }),
        });
        if (!response.ok) {
          const err = await response
            .json()
            .catch(() => ({ error: `HTTP ${response.status}` }));
          throw new Error(err.error || `Activation failed: ${response.status}`);
        }
        const result = await response.json();
        activationToken = result.licenseKey;
        isTrialActive = result.type === 'trial';
        console.log(
          `[LicenseManager] Backend activation succeeded for ${pluginId}`
        );
      } else {
        // Offline fallback
        console.warn(
          `[LicenseManager] MARKETPLACE_BACKEND_URL not set — using offline activation for ${pluginId}`
        );
        activationToken = `${LICENSE_TOKEN_PREFIX}${randomUUID()}`;
      }

      const licenseInfo: PluginLicenseInfo = {
        isActive: true,
        licenseKey: activationToken,
        activatedAt: new Date().toISOString(),
        isTrialActive,
        features: ['all'],
        installationId: mId,
        lastVerifiedAt: new Date().toISOString(),
      };

      if (isTrialActive) {
        const end = new Date();
        end.setDate(end.getDate() + TRIAL_DURATION_DAYS);
        licenseInfo.trialEndsAt = end.toISOString();
      }

      await pluginRegistry.updatePluginConfig(pluginId, {
        licenseInfo,
      });

      console.log(`[LicenseManager] License activated for ${pluginId}`);
      return { success: true };
    } catch (error: any) {
      console.error('[LicenseManager] Activation failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start a trial for a plugin via backend.
   */
  async startTrial(
    pluginId: string
  ): Promise<{ success: boolean; error?: string }> {
    // We reuse the activation endpoint with a special trial request key
    return this.activateLicense(pluginId, 'TRIAL-REQUEST');
  }

  /**
   * Deactivate a license locally and optionally notify backend.
   */
  async deactivateLicense(
    pluginId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const plugin = pluginRegistry.getPlugin(pluginId)?.plugin;
      if (!plugin || !plugin.licenseInfo) {
        return { success: false, error: 'No active license to deactivate' };
      }

      const updatedInfo: PluginLicenseInfo = {
        ...plugin.licenseInfo,
        isActive: false,
        licenseKey: undefined,
      };

      await pluginRegistry.updatePluginConfig(pluginId, {
        licenseInfo: updatedInfo,
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  getLicenseInfo(pluginId: string): PluginLicenseInfo | undefined {
    return pluginRegistry.getPlugin(pluginId)?.plugin.licenseInfo;
  }
}

export const licenseManager = new LicenseManager();
