import { describe, it, expect } from 'vitest';
import {
  toSandboxPermissions,
  buildPluginFrameUrls,
  pluginHostDocumentUrl,
} from '../../../../features/plugins/sandbox/frame-props';
import type { Plugin } from '../../../../../electron/types/plugin-types';

function makePlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    manifest: {
      id: 'demo',
      name: 'Demo',
      version: '1.0.0',
      description: '',
      author: '',
      license: { spdx: 'MIT' },
      permissions: ['kubernetes', 'ui'],
    },
    state: 'enabled',
    installedAt: '2026-01-01T00:00:00Z',
    rendererEntry: '/plugins/demo/renderer.js',
    rendererStyles: ['/plugins/demo/style.css'],
    ...overrides,
  } as Plugin;
}

describe('toSandboxPermissions', () => {
  it('returns an empty array for an undefined list', () => {
    expect(toSandboxPermissions(undefined)).toEqual([]);
  });

  it('keeps only the sandbox-known permissions', () => {
    expect(
      toSandboxPermissions([
        'kubernetes',
        'kubernetes:write',
        'helm',
        'secrets',
        'ui',
        'storage',
        'network',
        'notifications',
        'filesystem',
        'fs',
      ])
    ).toEqual([
      'kubernetes',
      'kubernetes:write',
      'helm',
      'secrets',
      'ui',
      'storage',
    ]);
  });

  it('drops all entries when none are recognised', () => {
    expect(toSandboxPermissions(['network', 'fs', 'notifications'])).toEqual(
      []
    );
  });
});

describe('pluginHostDocumentUrl', () => {
  it('resolves the shared host document against the base URI', () => {
    const url = pluginHostDocumentUrl();
    expect(url).toContain('plugin-host/index.html');
    expect(url.startsWith('http')).toBe(true);
  });
});

describe('buildPluginFrameUrls', () => {
  it('returns null when the plugin ships no renderer entry', () => {
    expect(
      buildPluginFrameUrls(makePlugin({ rendererEntry: undefined }))
    ).toBeNull();
  });

  it('builds entry, style and permission urls for a full plugin', () => {
    const urls = buildPluginFrameUrls(makePlugin());
    expect(urls).not.toBeNull();
    expect(urls!.hostDocumentUrl).toContain('plugin-host/index.html');
    expect(urls!.entryUrl).toBe('plugin-file://local/plugins/demo/renderer.js');
    expect(urls!.styleUrls).toEqual([
      'plugin-file://local/plugins/demo/style.css',
    ]);
    expect(urls!.permissions).toEqual(['kubernetes', 'ui']);
  });

  it('defaults styleUrls to an empty array when styles are missing', () => {
    const urls = buildPluginFrameUrls(
      makePlugin({ rendererStyles: undefined })
    );
    expect(urls!.styleUrls).toEqual([]);
  });

  it('filters manifest permissions down to the sandbox set', () => {
    const urls = buildPluginFrameUrls(
      makePlugin({
        manifest: {
          ...makePlugin().manifest,
          // A manifest from another Shoal version may name a permission
          // this build does not know.
          permissions: [
            'kubernetes',
            'network',
            'storage',
          ] as unknown as Plugin['manifest']['permissions'],
        },
      })
    );
    expect(urls!.permissions).toEqual(['kubernetes', 'storage']);
  });
});
