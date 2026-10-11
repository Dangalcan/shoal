import type {
  Plugin,
  PluginManifest,
} from '../../../../electron/types/plugin-types';

/** Builds an installed plugin; `manifest` overrides merge into the defaults. */
export function makePlugin(
  overrides: Omit<Partial<Plugin>, 'manifest'> & {
    manifest?: Partial<PluginManifest>;
  } = {}
): Plugin {
  const { manifest, ...rest } = overrides;
  return {
    state: 'disabled',
    installedAt: '2026-01-01T00:00:00Z',
    ...rest,
    manifest: {
      id: 'p1',
      name: 'Plugin One',
      version: '1.0.0',
      description: 'Does one thing.',
      author: 'Shoal Team',
      main: 'index.js',
      license: { type: 'free', spdx: 'MIT' },
      permissions: ['ui'],
      ...manifest,
    } as PluginManifest,
  } as Plugin;
}
