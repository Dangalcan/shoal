import { describe, it, expect } from 'vitest';
import path from 'path';
import { assertInsidePlugin } from '../utils/fs-utils';

describe('assertInsidePlugin', () => {
  const plugin = path.resolve('/plugins/demo');

  it('accepts files inside the plugin directory', () => {
    expect(() =>
      assertInsidePlugin(plugin, path.join(plugin, 'index.js'), 'main entry')
    ).not.toThrow();
    expect(() =>
      assertInsidePlugin(plugin, path.join(plugin, 'data', 'x.json'), 'data')
    ).not.toThrow();
  });

  it('refuses files that resolve outside it', () => {
    expect(() =>
      assertInsidePlugin(
        plugin,
        path.join(plugin, '..', 'other', 'x.js'),
        'main entry'
      )
    ).toThrow(/escapes the plugin directory/);
    expect(() =>
      assertInsidePlugin(
        plugin,
        path.resolve('/plugins/demo-evil/x.js'),
        'data file'
      )
    ).toThrow(/escapes/);
  });
});
