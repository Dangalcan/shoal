/**
 * License Manager
 *
 * Handles plugin licensing, activation, validation, and trial management.
 * Persists license data via PluginRegistry.
 */

import { randomUUID } from 'crypto';
import { machineIdSync } from 'node-machine-id';
import { pluginRegistry } from '../plugins/plugin-registry';
import type {
  PluginLicenseInfo,
  Plugin,
  PluginLicenseType,
} from '../../types/plugin-types';

const MARKETPLACE_API_URL = 'http://localhost:3001';

export interface LicenseValidationResult {
  valid: boolean;
  error?: string;
  licenseInfo?: PluginLicenseInfo;
}

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
    const GRACE_PERIOD_DAYS = 7;
    const REVERIFICATION_INTERVAL_HOURS = 24;

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
  async activateLicense(
    pluginId: string,
    licenseKey: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const mId = machineIdSync();
      console.log(
        `[LicenseManager] Activating license for ${pluginId} with key ${licenseKey}...`
      );

      const response = await fetch(`${MARKETPLACE_API_URL}/licenses/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginId,
          machineId: mId,
          licenseKey,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to activate license');
      }

      const data = await response.json();

      // The backend returns a JWT licenseKey. We extract info for local storage.
      // In a real app, we'd verify the JWT here too.
      const licenseInfo: PluginLicenseInfo = {
        isActive: true,
        licenseKey: data.licenseKey,
        activatedAt: new Date().toISOString(),
        isTrialActive: data.type === 'trial',
        features: ['all'],
        installationId: mId,
        lastVerifiedAt: new Date().toISOString(),
      };

      await pluginRegistry.updatePluginConfig(pluginId, {
        licenseInfo,
      });

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
