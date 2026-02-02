import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LicenseManager } from '../services/security/license-manager';
import { pluginRegistry } from '../services/plugins/plugin-registry';
import { machineIdSync } from 'node-machine-id';

// Mock dependencies
vi.mock('../services/plugins/plugin-registry', () => ({
  pluginRegistry: {
    getPlugin: vi.fn(),
    updatePluginConfig: vi.fn(),
  },
}));

vi.mock('node-machine-id', () => ({
  machineIdSync: vi.fn(() => 'test-machine-id'),
}));

// Mock global fetch for license activation
global.fetch = vi.fn();

describe('LicenseManager', () => {
  let licenseManager: LicenseManager;

  beforeEach(() => {
    vi.clearAllMocks();
    licenseManager = new LicenseManager();
  });

  describe('checkLicense', () => {
    it('should return valid for free plugins', () => {
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: {
          manifest: { license: { type: 'free' } },
        } as any,
        config: { enabled: true },
      });

      const result = licenseManager.checkLicense('free-plugin');
      expect(result.valid).toBe(true);
    });

    it('should return invalid if no license found for paid plugin', () => {
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: {
          manifest: { license: { type: 'paid' } },
          licenseInfo: undefined,
        } as any,
        config: { enabled: true },
      });

      const result = licenseManager.checkLicense('paid-plugin');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No license found');
    });

    it('should return valid for active trial', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: {
          manifest: { license: { type: 'paid' } },
          licenseInfo: {
            isActive: true,
            isTrialActive: true,
            trialEndsAt: futureDate.toISOString(),
          },
        } as any,
        config: { enabled: true },
      });

      const result = licenseManager.checkLicense('trial-plugin');
      expect(result.valid).toBe(true);
    });

    it('should return invalid for expired trial', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: {
          manifest: { license: { type: 'paid' } },
          licenseInfo: {
            isActive: true,
            isTrialActive: true,
            trialEndsAt: pastDate.toISOString(),
          },
        } as any,
        config: { enabled: true },
      });

      const result = licenseManager.checkLicense('expired-trial');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Trial expired');
    });

    it('should return invalid for expired full license', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: {
          manifest: { license: { type: 'paid' } },
          licenseInfo: {
            isActive: true,
            isTrialActive: false,
            expiresAt: pastDate.toISOString(),
          },
        } as any,
        config: { enabled: true },
      });

      const result = licenseManager.checkLicense('expired-license');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('License expired');
    });

    it('should return invalid if offline for too long (grace period expired)', () => {
      const longAgo = new Date();
      longAgo.setDate(longAgo.getDate() - 10); // 10 days ago (grace is 7)

      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: {
          manifest: { license: { type: 'paid' } },
          licenseInfo: {
            isActive: true,
            activatedAt: longAgo.toISOString(),
            lastVerifiedAt: longAgo.toISOString(),
          },
        } as any,
        config: { enabled: true },
      });

      const result = licenseManager.checkLicense('offline-plugin');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('verification required');
    });

    it('should return valid if in grace period', () => {
      const recently = new Date();
      recently.setDate(recently.getDate() - 5); // 5 days ago (grace is 7)

      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: {
          manifest: { license: { type: 'paid' } },
          licenseInfo: {
            isActive: true,
            activatedAt: recently.toISOString(),
            lastVerifiedAt: recently.toISOString(),
          },
        } as any,
        config: { enabled: true },
      });

      const result = licenseManager.checkLicense('grace-plugin');
      expect(result.valid).toBe(true);
    });

    it('should return invalid if plugin not found', () => {
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue(undefined);
      const result = licenseManager.checkLicense('missing-plugin');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Plugin not found');
    });

    it('should return invalid if trialEndsAt is missing for trial', () => {
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: {
          manifest: { license: { type: 'paid' } },
          licenseInfo: {
            isActive: true,
            isTrialActive: true,
            trialEndsAt: undefined,
          },
        } as any,
        config: { enabled: true },
      });

      const result = licenseManager.checkLicense('bad-trial');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid trial license');
    });

    it('should return invalid if license is not active', () => {
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: {
          manifest: { license: { type: 'paid' } },
          licenseInfo: {
            isActive: false,
          },
        } as any,
        config: { enabled: true },
      });

      const result = licenseManager.checkLicense('inactive-license');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('License is not active');
    });
  });

  describe('activateLicense', () => {
    it('should activate successfully with valid key', async () => {
      const result = await licenseManager.activateLicense(
        'plugin-1',
        'valid-key-123'
      );

      expect(result.success).toBe(true);
      expect(pluginRegistry.updatePluginConfig).toHaveBeenCalledWith(
        'plugin-1',
        expect.objectContaining({
          licenseInfo: expect.objectContaining({
            isActive: true,
            features: ['all'],
          }),
        })
      );
    });

    it('should fail with invalid key format', async () => {
      const result = await licenseManager.activateLicense('plugin-1', 'bad');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid license key format');
      expect(pluginRegistry.updatePluginConfig).not.toHaveBeenCalled();
    });
  });

  describe('startTrial', () => {
    it('should call activateLicense with TRIAL-REQUEST', async () => {
      const activateSpy = vi
        .spyOn(licenseManager, 'activateLicense')
        .mockResolvedValue({ success: true });

      const result = await licenseManager.startTrial('plugin-1');

      expect(activateSpy).toHaveBeenCalledWith('plugin-1', 'TRIAL-REQUEST');
      expect(result.success).toBe(true);
    });
  });

  describe('deactivateLicense', () => {
    it('should update registry on success', async () => {
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: {
          licenseInfo: { isActive: true, licenseKey: 'old-key' },
        } as any,
        config: { enabled: true },
      });

      const result = await licenseManager.deactivateLicense('plugin-1');

      expect(result.success).toBe(true);
      expect(pluginRegistry.updatePluginConfig).toHaveBeenCalledWith(
        'plugin-1',
        expect.objectContaining({
          licenseInfo: expect.objectContaining({
            isActive: false,
            licenseKey: undefined,
          }),
        })
      );
    });

    it('should handle missing license info', async () => {
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: { licenseInfo: undefined } as any,
        config: { enabled: true },
      });

      const result = await licenseManager.deactivateLicense('plugin-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No active license to deactivate');
    });

    it('should handle registry errors', async () => {
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: { licenseInfo: { isActive: true } } as any,
        config: { enabled: true },
      });
      vi.mocked(pluginRegistry.updatePluginConfig).mockRejectedValue(
        new Error('Update failed')
      );

      const result = await licenseManager.deactivateLicense('plugin-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  describe('getLicenseInfo', () => {
    it('should return license info from registry', () => {
      const mockInfo = { isActive: true, licenseKey: 'abc' };
      vi.mocked(pluginRegistry.getPlugin).mockReturnValue({
        plugin: { licenseInfo: mockInfo } as any,
        config: { enabled: true },
      });

      const result = licenseManager.getLicenseInfo('plugin-1');
      expect(result).toEqual(mockInfo);
    });
  });
});
