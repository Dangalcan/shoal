import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/userData'),
  },
}));

vi.mock('fs/promises', () => {
  const m = {
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
  return { ...m, default: m };
});

// Mock encryption so tests are deterministic and independent of machine-id.
// `enc:` is the current scheme, `old:` a readable older one and `bad:` a
// value no key can read.
vi.mock('../services/security/encryption-utils', () => ({
  encrypt: vi.fn((text: string) => `enc:${text}`),
  decrypt: vi.fn((text: string) => {
    if (text.startsWith('enc:') || text.startsWith('old:'))
      return text.slice(4);
    return text.startsWith('bad:') ? '' : text;
  }),
  usesCurrentScheme: vi.fn((text: string) => text.startsWith('enc:')),
}));

import fs from 'fs/promises';
import log from '../logger';
import { PluginRegistry } from '../services/plugins/plugin-registry';
import type { Plugin, PluginConfig } from '../types/plugin-types';

const makePlugin = (id: string, name = 'Test Plugin'): Plugin =>
  ({
    manifest: {
      id,
      name,
      version: '1.0.0',
      license: { type: 'free' },
    },
  }) as unknown as Plugin;

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: config file does not exist (ENOENT)
    vi.mocked(fs.readFile).mockRejectedValue(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    );
    registry = new PluginRegistry();
  });

  // ── initialize ──────────────────────────────────────────────────────────────

  describe('initialize', () => {
    it('should initialize without error when config file is missing (ENOENT)', async () => {
      await expect(registry.initialize()).resolves.toBeUndefined();
    });

    it('should load config and decrypt license keys on success', async () => {
      const saved = {
        'plugin-a': {
          enabled: true,
          settings: {},
          licenseInfo: { licenseKey: 'enc:secret-key' },
        },
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(saved));

      await registry.initialize();

      const config = await registry.getPluginConfig('plugin-a');
      expect(config?.licenseInfo?.licenseKey).toBe('secret-key');
    });

    it('should swallow non-ENOENT errors from config file', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));
      await expect(registry.initialize()).resolves.toBeUndefined();
    });

    it('should log and not throw when initialization itself errors', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Unexpected'));
      await expect(registry.initialize()).resolves.toBeUndefined();
    });

    it('logs a failure that escapes the configuration loader', async () => {
      // A rejection without an error object has no `code` to compare with
      // ENOENT, so the loader's own handler fails; initialize still resolves.
      vi.mocked(fs.readFile).mockRejectedValue(null);
      const errorSpy = vi.spyOn(log, 'error').mockImplementation(() => {});
      try {
        await expect(registry.initialize()).resolves.toBeUndefined();
        expect(errorSpy).toHaveBeenCalledWith(
          '[PluginRegistry] Failed to initialize:',
          expect.any(String)
        );
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  // ── saveConfiguration ───────────────────────────────────────────────────────

  describe('saveConfiguration', () => {
    it('should write config JSON to disk', async () => {
      await registry.saveConfiguration();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('plugin-config.json'),
        expect.any(String),
        { encoding: 'utf-8', mode: 0o600 }
      );
    });

    it('should encrypt license keys before saving', async () => {
      const plugin = makePlugin('paid-plugin');
      const config: PluginConfig = {
        enabled: true,
        settings: {},
        licenseInfo: { isActive: true, licenseKey: 'raw-key' } as any,
      };
      await registry.registerPlugin(plugin, config);

      const writtenJson = vi
        .mocked(fs.writeFile)
        .mock.calls.at(-1)![1] as string;
      const written = JSON.parse(writtenJson);
      expect(written['paid-plugin'].licenseInfo.licenseKey).toBe('enc:raw-key');
    });

    it('should throw and propagate writeFile errors', async () => {
      vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('Disk full'));
      await expect(registry.saveConfiguration()).rejects.toThrow('Disk full');
    });

    it('should not encrypt if licenseKey is absent', async () => {
      const plugin = makePlugin('free-plugin');
      const config: PluginConfig = { enabled: true, settings: {} };
      await registry.registerPlugin(plugin, config);

      const { encrypt } = await import('../services/security/encryption-utils');
      expect(encrypt).not.toHaveBeenCalled();
    });
  });

  // ── secret-flagged settings ─────────────────────────────────────────────────

  describe('secret-flagged settings', () => {
    const makeSecretPlugin = (id: string): Plugin =>
      ({
        manifest: {
          id,
          name: 'Secret Plugin',
          version: '1.0.0',
          license: { type: 'free' },
          configuration: {
            title: 'Settings',
            properties: {
              apiToken: { type: 'string', label: 'API Token', secret: true },
              owner: { type: 'string', label: 'Owner' },
            },
          },
        },
      }) as unknown as Plugin;

    it('encrypts secret values at rest and decrypts them on read', async () => {
      const plugin = makeSecretPlugin('secret-plugin');
      await registry.registerPlugin(plugin, { enabled: true, settings: {} });

      await registry.updatePluginSettings('secret-plugin', {
        apiToken: 'ghp_supersecret',
        owner: 'daniel',
      });

      // Stored copy is encrypted with the sentinel prefix…
      const writtenJson = vi
        .mocked(fs.writeFile)
        .mock.calls.at(-1)![1] as string;
      const written = JSON.parse(writtenJson);
      expect(written['secret-plugin'].settings.apiToken).toBe(
        'enc::enc:ghp_supersecret'
      );
      // …non-secret keys stay plaintext…
      expect(written['secret-plugin'].settings.owner).toBe('daniel');
      // …and reads get the decrypted value back.
      const settings = registry.getPluginSettings('secret-plugin');
      expect(settings.apiToken).toBe('ghp_supersecret');
      expect(settings.owner).toBe('daniel');
    });

    it('does not double-encrypt an already-encrypted value', async () => {
      const plugin = makeSecretPlugin('secret-plugin');
      await registry.registerPlugin(plugin, { enabled: true, settings: {} });

      await registry.updatePluginSettings('secret-plugin', {
        apiToken: 'tok',
      });
      // Merging an unrelated key must not re-encrypt the stored ciphertext
      await registry.updatePluginSettings('secret-plugin', {
        owner: 'daniel',
      });

      expect(registry.getPluginSettings('secret-plugin').apiToken).toBe('tok');
      const { encrypt } = await import('../services/security/encryption-utils');
      expect(encrypt).toHaveBeenCalledTimes(1);
    });

    it('migrates plaintext secrets persisted by older builds on registration', async () => {
      const plugin = makeSecretPlugin('secret-plugin');
      await registry.registerPlugin(plugin, {
        enabled: true,
        settings: { apiToken: 'legacy-plaintext' },
      });

      const writtenJson = vi
        .mocked(fs.writeFile)
        .mock.calls.at(-1)![1] as string;
      const written = JSON.parse(writtenJson);
      expect(written['secret-plugin'].settings.apiToken).toBe(
        'enc::enc:legacy-plaintext'
      );
      expect(registry.getPluginSettings('secret-plugin').apiToken).toBe(
        'legacy-plaintext'
      );
    });

    it('leaves empty and non-string secret values untouched', async () => {
      const plugin = makeSecretPlugin('secret-plugin');
      await registry.registerPlugin(plugin, { enabled: true, settings: {} });

      await registry.updatePluginSettings('secret-plugin', { apiToken: '' });
      expect(registry.getPluginSettings('secret-plugin').apiToken).toBe('');
    });

    it('re-encrypts a secret stored with an older scheme on registration', async () => {
      const saved = {
        'secret-plugin': {
          enabled: true,
          settings: { apiToken: 'enc::old:tok', owner: 'daniel' },
        },
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(saved));
      await registry.initialize();

      await registry.registerPlugin(makeSecretPlugin('secret-plugin'));

      const writtenJson = vi
        .mocked(fs.writeFile)
        .mock.calls.at(-1)![1] as string;
      const written = JSON.parse(writtenJson);
      expect(written['secret-plugin'].settings.apiToken).toBe('enc::enc:tok');
      expect(written['secret-plugin'].settings.owner).toBe('daniel');
      expect(registry.getPluginSettings('secret-plugin').apiToken).toBe('tok');
    });

    it('leaves a secret it cannot decrypt as stored', async () => {
      const saved = {
        'secret-plugin': {
          enabled: true,
          settings: { apiToken: 'enc::bad:tok' },
        },
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(saved));
      await registry.initialize();

      await registry.registerPlugin(makeSecretPlugin('secret-plugin'));

      const writtenJson = vi
        .mocked(fs.writeFile)
        .mock.calls.at(-1)![1] as string;
      const written = JSON.parse(writtenJson);
      expect(written['secret-plugin'].settings.apiToken).toBe('enc::bad:tok');
      expect(registry.getPluginSettings('secret-plugin').apiToken).toBe('');
      const { encrypt } = await import('../services/security/encryption-utils');
      expect(encrypt).not.toHaveBeenCalled();
    });
  });

  // ── registerPlugin ──────────────────────────────────────────────────────────

  describe('registerPlugin', () => {
    it('should register plugin with explicit config', async () => {
      const plugin = makePlugin('p1');
      await registry.registerPlugin(plugin, { enabled: true, settings: {} });

      expect(registry.hasPlugin('p1')).toBe(true);
      expect(registry.getPluginCount()).toBe(1);
    });

    it('stores empty settings when the given config has none', async () => {
      await registry.registerPlugin(makePlugin('p-bare'), {
        enabled: true,
      });

      expect(registry.getPlugin('p-bare')?.config).toEqual({
        enabled: true,
        settings: {},
      });
      expect(registry.getPluginSettings('p-bare')).toEqual({});
    });

    it('should fall back to default config when none supplied', async () => {
      const plugin = makePlugin('p2');
      await registry.registerPlugin(plugin);

      const entry = registry.getPlugin('p2');
      expect(entry?.config.enabled).toBe(false);
    });

    it('should use cached config when available and none supplied', async () => {
      const saved = { p3: { enabled: true, settings: { theme: 'dark' } } };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(saved));
      await registry.initialize();

      const plugin = makePlugin('p3');
      await registry.registerPlugin(plugin); // no explicit config

      const entry = registry.getPlugin('p3');
      expect(entry?.config.enabled).toBe(true);
      expect(entry?.config.settings?.theme).toBe('dark');
    });

    it('should sync licenseInfo from config to plugin instance', async () => {
      const plugin = makePlugin('p4');
      const licenseInfo = { isActive: true } as any;
      await registry.registerPlugin(plugin, {
        enabled: true,
        settings: {},
        licenseInfo,
      });

      expect(registry.getPlugin('p4')?.plugin.licenseInfo).toEqual(licenseInfo);
    });
  });

  // ── unregisterPlugin ────────────────────────────────────────────────────────

  describe('unregisterPlugin', () => {
    it('should remove the plugin from registry', async () => {
      await registry.registerPlugin(makePlugin('p1'));
      await registry.unregisterPlugin('p1');
      expect(registry.hasPlugin('p1')).toBe(false);
    });
  });

  // ── getPlugin / getAllPlugins / getEnabledPlugins ─────────────────────────

  describe('getPlugin', () => {
    it('should return undefined for unknown plugin', () => {
      expect(registry.getPlugin('unknown')).toBeUndefined();
    });
  });

  describe('getAllPlugins', () => {
    it('should return all registered plugins', async () => {
      await registry.registerPlugin(makePlugin('p1'));
      await registry.registerPlugin(makePlugin('p2'));
      expect(registry.getAllPlugins()).toHaveLength(2);
    });
  });

  describe('getEnabledPlugins', () => {
    it('should return only enabled plugins', async () => {
      await registry.registerPlugin(makePlugin('p1'), {
        enabled: true,
        settings: {},
      });
      await registry.registerPlugin(makePlugin('p2'), {
        enabled: false,
        settings: {},
      });
      const enabled = registry.getEnabledPlugins();
      expect(enabled).toHaveLength(1);
      expect(enabled[0].manifest.id).toBe('p1');
    });
  });

  // ── updatePluginConfig ───────────────────────────────────────────────────

  describe('updatePluginConfig', () => {
    it('should throw if plugin is not registered', async () => {
      await expect(
        registry.updatePluginConfig('nonexistent', { enabled: true })
      ).rejects.toThrow('Plugin nonexistent not found in registry');
    });

    it('should merge config fields', async () => {
      await registry.registerPlugin(makePlugin('p1'), {
        enabled: false,
        settings: {},
      });
      await registry.updatePluginConfig('p1', { enabled: true });
      expect(registry.getPlugin('p1')?.config.enabled).toBe(true);
    });

    it('should sync licenseInfo to plugin instance when provided', async () => {
      await registry.registerPlugin(makePlugin('p1'));
      const newLicense = { isActive: true, licenseKey: 'new-key' } as any;
      await registry.updatePluginConfig('p1', { licenseInfo: newLicense });
      expect(registry.getPlugin('p1')?.plugin.licenseInfo).toEqual(newLicense);
    });

    it('should not touch plugin.licenseInfo when not updating it', async () => {
      await registry.registerPlugin(makePlugin('p1'));
      await registry.updatePluginConfig('p1', { enabled: true });
      // licenseInfo stays undefined
      expect(registry.getPlugin('p1')?.plugin.licenseInfo).toBeUndefined();
    });
  });

  // ── enablePlugin / disablePlugin ────────────────────────────────────────

  describe('enablePlugin / disablePlugin', () => {
    it('should enable a registered plugin', async () => {
      await registry.registerPlugin(makePlugin('p1'), {
        enabled: false,
        settings: {},
      });
      await registry.enablePlugin('p1');
      expect(registry.isPluginEnabled('p1')).toBe(true);
    });

    it('should disable a registered plugin', async () => {
      await registry.registerPlugin(makePlugin('p1'), {
        enabled: true,
        settings: {},
      });
      await registry.disablePlugin('p1');
      expect(registry.isPluginEnabled('p1')).toBe(false);
    });
  });

  // ── isPluginEnabled ──────────────────────────────────────────────────────

  describe('isPluginEnabled', () => {
    it('should return false for unknown plugin', () => {
      expect(registry.isPluginEnabled('ghost')).toBe(false);
    });
  });

  // ── updatePluginSettings / getPluginSettings ─────────────────────────────

  describe('updatePluginSettings', () => {
    it('should throw if plugin not registered', async () => {
      await expect(
        registry.updatePluginSettings('ghost', { foo: 'bar' })
      ).rejects.toThrow('Plugin ghost not found in registry');
    });

    it('should merge settings', async () => {
      await registry.registerPlugin(makePlugin('p1'), {
        enabled: true,
        settings: { a: 1 },
      });
      await registry.updatePluginSettings('p1', { b: 2 });
      expect(registry.getPluginSettings('p1')).toEqual({ a: 1, b: 2 });
    });
  });

  describe('getPluginSettings', () => {
    it('should return empty object for unknown plugin', () => {
      expect(registry.getPluginSettings('ghost')).toEqual({});
    });
  });

  // ── context management ────────────────────────────────────────────────────

  describe('setPluginContext / getPluginContext / clearPluginContext', () => {
    it('should set and get plugin context', async () => {
      await registry.registerPlugin(makePlugin('p1'));
      const ctx = { dispose: vi.fn() };
      registry.setPluginContext('p1', ctx);
      expect(registry.getPluginContext('p1')).toBe(ctx);
    });

    it('should return undefined for unknown plugin context', () => {
      expect(registry.getPluginContext('ghost')).toBeUndefined();
    });

    it('should clear plugin context', async () => {
      await registry.registerPlugin(makePlugin('p1'));
      registry.setPluginContext('p1', { foo: true });
      registry.clearPluginContext('p1');
      expect(registry.getPluginContext('p1')).toBeUndefined();
    });

    it('should be a no-op when clearing context of unknown plugin', () => {
      expect(() => registry.clearPluginContext('ghost')).not.toThrow();
    });

    it('should be a no-op when setting context of unknown plugin', () => {
      expect(() => registry.setPluginContext('ghost', {})).not.toThrow();
    });
  });

  // ── hasPlugin / getPluginCount / clear ───────────────────────────────────

  describe('hasPlugin', () => {
    it('should return true for registered and false for missing', async () => {
      await registry.registerPlugin(makePlugin('p1'));
      expect(registry.hasPlugin('p1')).toBe(true);
      expect(registry.hasPlugin('p2')).toBe(false);
    });
  });

  describe('getPluginCount', () => {
    it('should reflect number of registered plugins', async () => {
      expect(registry.getPluginCount()).toBe(0);
      await registry.registerPlugin(makePlugin('p1'));
      expect(registry.getPluginCount()).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all plugins from registry', async () => {
      await registry.registerPlugin(makePlugin('p1'));
      await registry.registerPlugin(makePlugin('p2'));
      registry.clear();
      expect(registry.getPluginCount()).toBe(0);
    });
  });
});
