import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: false },
}));

vi.mock('node-machine-id', () => ({
  machineIdSync: vi.fn(() => 'mock-machine-id'),
}));

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockGetPlugin, mockUpdateConfig } = vi.hoisted(() => ({
  mockGetPlugin: vi.fn(),
  mockUpdateConfig: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/plugins/plugin-registry', () => ({
  pluginRegistry: {
    getPlugin: mockGetPlugin,
    updatePluginConfig: mockUpdateConfig,
  },
}));

vi.mock('../utils/env-utils', () => ({
  isProduction: vi.fn(() => false),
}));

import { LicenseManager } from '../services/security/license-manager';
import { isProduction } from '../utils/env-utils';
import type { PluginLicenseInfo } from '../types/plugin-types';

function makePlugin(
  licenseType: 'free' | 'paid',
  licenseInfo?: Partial<PluginLicenseInfo>
) {
  return {
    plugin: {
      manifest: {
        id: 'test-plugin',
        license: { type: licenseType },
      },
      licenseInfo: licenseInfo
        ? {
            isActive: false,
            isTrialActive: false,
            features: [],
            installationId: 'machine-id',
            activatedAt: new Date().toISOString(),
            lastVerifiedAt: new Date().toISOString(),
            ...licenseInfo,
          }
        : undefined,
    },
    config: { enabled: true },
  };
}

describe('LicenseManager', () => {
  let manager: LicenseManager;

  beforeEach(() => {
    manager = new LicenseManager();
    vi.clearAllMocks();
    mockUpdateConfig.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('checkLicense', () => {
    it('returns valid for free plugins', () => {
      mockGetPlugin.mockReturnValue(makePlugin('free'));
      const result = manager.checkLicense('test-plugin');
      expect(result.valid).toBe(true);
    });

    it('returns invalid when plugin not found', () => {
      mockGetPlugin.mockReturnValue(undefined);
      const result = manager.checkLicense('missing-plugin');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Plugin not found');
    });

    it('returns invalid when no license info on paid plugin', () => {
      mockGetPlugin.mockReturnValue(makePlugin('paid', undefined));
      const result = manager.checkLicense('test-plugin');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No license found');
    });

    it('returns valid for active trial', () => {
      const future = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString();
      mockGetPlugin.mockReturnValue(
        makePlugin('paid', { isTrialActive: true, trialEndsAt: future })
      );
      const result = manager.checkLicense('test-plugin');
      expect(result.valid).toBe(true);
    });

    it('returns invalid for expired trial', () => {
      const past = new Date(Date.now() - 1000).toISOString();
      mockGetPlugin.mockReturnValue(
        makePlugin('paid', { isTrialActive: true, trialEndsAt: past })
      );
      const result = manager.checkLicense('test-plugin');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Trial expired');
    });

    it('returns invalid when license not active', () => {
      mockGetPlugin.mockReturnValue(makePlugin('paid', { isActive: false }));
      const result = manager.checkLicense('test-plugin');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('License is not active');
    });

    it('returns valid for active license within reverification window', () => {
      const recentVerification = new Date(
        Date.now() - 60 * 60 * 1000
      ).toISOString();
      mockGetPlugin.mockReturnValue(
        makePlugin('paid', {
          isActive: true,
          lastVerifiedAt: recentVerification,
        })
      );
      const result = manager.checkLicense('test-plugin');
      expect(result.valid).toBe(true);
    });

    it('returns invalid for license expired', () => {
      const past = new Date(Date.now() - 1000).toISOString();
      mockGetPlugin.mockReturnValue(
        makePlugin('paid', { isActive: true, expiresAt: past })
      );
      const result = manager.checkLicense('test-plugin');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('License expired');
    });

    it('remains valid during grace period (25h overdue)', () => {
      const oldVerification = new Date(
        Date.now() - 25 * 60 * 60 * 1000
      ).toISOString();
      mockGetPlugin.mockReturnValue(
        makePlugin('paid', { isActive: true, lastVerifiedAt: oldVerification })
      );
      const result = manager.checkLicense('test-plugin');
      expect(result.valid).toBe(true);
    });

    it('fails after grace period expires (8 days)', () => {
      const veryOld = new Date(
        Date.now() - 8 * 24 * 60 * 60 * 1000
      ).toISOString();
      mockGetPlugin.mockReturnValue(
        makePlugin('paid', { isActive: true, lastVerifiedAt: veryOld })
      );
      const result = manager.checkLicense('test-plugin');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('offline for too long');
    });
  });

  describe('activateLicense', () => {
    it('rejects short license keys', async () => {
      mockGetPlugin.mockReturnValue(makePlugin('paid', { isActive: false }));
      const result = await manager.activateLicense('test-plugin', 'abc');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid license key format');
    });

    it('generates offline token when no backend URL is set', async () => {
      vi.stubEnv('MARKETPLACE_BACKEND_URL', '');
      mockGetPlugin.mockReturnValue(makePlugin('paid', { isActive: false }));

      const result = await manager.activateLicense(
        'test-plugin',
        'VALID-LICENSE-KEY'
      );

      expect(result.success).toBe(true);
      expect(mockUpdateConfig).toHaveBeenCalledWith(
        'test-plugin',
        expect.objectContaining({
          licenseInfo: expect.objectContaining({ isActive: true }),
        })
      );
    });

    it('activates trial via backend', async () => {
      vi.stubEnv('MARKETPLACE_BACKEND_URL', 'http://localhost:3001');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            licenseKey: 'BACKEND-TOKEN-123',
            type: 'trial',
          }),
        })
      );

      const result = await manager.activateLicense(
        'test-plugin',
        'TRIAL-REQUEST'
      );

      expect(result.success).toBe(true);
      expect(mockUpdateConfig).toHaveBeenCalledWith(
        'test-plugin',
        expect.objectContaining({
          licenseInfo: expect.objectContaining({ isTrialActive: true }),
        })
      );
    });

    it('returns failure when backend activation fails', async () => {
      vi.stubEnv('MARKETPLACE_BACKEND_URL', 'http://localhost:3001');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: async () => ({ error: 'Invalid license key' }),
        })
      );

      const result = await manager.activateLicense(
        'test-plugin',
        'INVALID-KEY-12345'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid license key');
    });

    it('reports the HTTP status when the backend error has no message', async () => {
      vi.stubEnv('MARKETPLACE_BACKEND_URL', 'http://localhost:3001');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({}),
        })
      );

      const result = await manager.activateLicense(
        'test-plugin',
        'SOME-LICENSE-KEY'
      );

      expect(result).toEqual({
        success: false,
        error: 'Activation failed: 403',
      });
      expect(mockUpdateConfig).not.toHaveBeenCalled();
    });

    it('refuses an offline token in production builds', async () => {
      vi.stubEnv('MARKETPLACE_BACKEND_URL', '');
      vi.mocked(isProduction).mockReturnValueOnce(true);
      mockGetPlugin.mockReturnValue(makePlugin('paid', { isActive: false }));

      const result = await manager.activateLicense(
        'test-plugin',
        'VALID-LICENSE-KEY'
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(
        /requires MARKETPLACE_BACKEND_URL to be configured in production/
      );
      expect(mockUpdateConfig).not.toHaveBeenCalled();
    });
  });

  describe('checkLicense – expiry date in the future', () => {
    it('stays valid until the expiry date', () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      mockGetPlugin.mockReturnValue(
        makePlugin('paid', { isActive: true, expiresAt: future })
      );

      expect(manager.checkLicense('test-plugin')).toEqual({ valid: true });
    });
  });

  describe('deactivateLicense', () => {
    it('deactivates an active license', async () => {
      mockGetPlugin.mockReturnValue(
        makePlugin('paid', {
          isActive: true,
          licenseKey: 'some-key',
        })
      );

      const result = await manager.deactivateLicense('test-plugin');

      expect(result.success).toBe(true);
      expect(mockUpdateConfig).toHaveBeenCalledWith(
        'test-plugin',
        expect.objectContaining({
          licenseInfo: expect.objectContaining({ isActive: false }),
        })
      );
    });

    it('returns error when no license to deactivate', async () => {
      mockGetPlugin.mockReturnValue(makePlugin('paid', undefined));

      const result = await manager.deactivateLicense('test-plugin');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No active license');
    });

    it('returns error when plugin not found', async () => {
      mockGetPlugin.mockReturnValue(undefined);

      const result = await manager.deactivateLicense('test-plugin');

      expect(result.success).toBe(false);
    });
  });
});
