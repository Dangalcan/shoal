import { describe, it, expect } from 'vitest';
import { dependencyResolver } from '../services/plugins/dependency-resolver';
import type { Plugin } from '../types/plugin-types';

describe('DependencyResolver', () => {
  const createMockPlugin = (
    id: string,
    version: string,
    dependencies: Record<string, string> = {}
  ): Plugin =>
    ({
      manifest: {
        id,
        name: id,
        version,
        author: 'test',
        main: 'index.js',
        dependencies,
      },
    }) as Plugin;

  it('should validate missing dependencies', () => {
    const plugin = createMockPlugin('p1', '1.0.0', { missing: '1.0.0' });
    const allPlugins = new Map<string, Plugin>();

    const result = dependencyResolver.validateDependencies(plugin, allPlugins);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('missing');
  });

  it('should validate version constraints', () => {
    const p1 = createMockPlugin('p1', '1.0.0', { p2: '^2.0.0' });
    const p2 = createMockPlugin('p2', '1.5.0');
    const allPlugins = new Map<string, Plugin>([['p2', p2]]);

    const result = dependencyResolver.validateDependencies(p1, allPlugins);
    expect(result.valid).toBe(false);
    expect(result.incompatible[0].pluginId).toBe('p2');
    expect(result.incompatible[0].installed).toBe('1.5.0');
    expect(result.incompatible[0].required).toBe('^2.0.0');
  });

  it('should detect circular dependencies', () => {
    const p1 = createMockPlugin('p1', '1.0.0', { p2: '1.0.0' });
    const p2 = createMockPlugin('p2', '1.0.0', { p1: '1.0.0' });
    const allPlugins = new Map<string, Plugin>([
      ['p1', p1],
      ['p2', p2],
    ]);

    const result = dependencyResolver.validateDependencies(p1, allPlugins);
    expect(result.valid).toBe(false);
    expect(result.circular.length).toBeGreaterThan(0);
  });

  it('is valid when the plugin declares no dependencies', () => {
    const plugin = createMockPlugin('p1', '1.0.0');
    delete (plugin.manifest as { dependencies?: unknown }).dependencies;

    const result = dependencyResolver.validateDependencies(plugin, new Map());
    expect(result).toEqual({
      valid: true,
      missing: [],
      incompatible: [],
      circular: [],
    });
  });

  it('is valid when all dependencies are present and compatible', () => {
    const p1 = createMockPlugin('p1', '1.0.0', { p2: '^1.0.0' });
    const p2 = createMockPlugin('p2', '1.4.2');
    const result = dependencyResolver.validateDependencies(
      p1,
      new Map([['p2', p2]])
    );
    expect(result.valid).toBe(true);
  });

  it('does not revisit already-checked plugins in diamond dependency graphs', () => {
    // p1 → p2 → p4 and p1 → p3 → p4: p4 is reached twice but is not circular.
    const p1 = createMockPlugin('p1', '1.0.0', { p2: '1.0.0', p3: '1.0.0' });
    const p2 = createMockPlugin('p2', '1.0.0', { p4: '1.0.0' });
    const p3 = createMockPlugin('p3', '1.0.0', { p4: '1.0.0' });
    const p4 = createMockPlugin('p4', '1.0.0');
    const all = new Map<string, Plugin>([
      ['p1', p1],
      ['p2', p2],
      ['p3', p3],
      ['p4', p4],
    ]);

    const result = dependencyResolver.validateDependencies(p1, all);
    expect(result.valid).toBe(true);
    expect(result.circular).toEqual([]);
  });

  it('lists the plugins that depend on a given plugin', () => {
    const p1 = createMockPlugin('p1', '1.0.0', { core: '1.0.0' });
    const p2 = createMockPlugin('p2', '1.0.0', { other: '1.0.0' });
    const p3 = createMockPlugin('p3', '1.0.0');
    delete (p3.manifest as { dependencies?: unknown }).dependencies;

    const dependents = dependencyResolver.getDependents('core', [p1, p2, p3]);
    expect(dependents.map((p) => p.manifest.id)).toEqual(['p1']);
    expect(dependencyResolver.getDependents('nobody', [p1, p2, p3])).toEqual(
      []
    );
  });

  it('should determine correct activation order', () => {
    const p1 = createMockPlugin('p1', '1.0.0', { p2: '1.0.0', p3: '1.0.0' });
    const p2 = createMockPlugin('p2', '1.0.0', { p3: '1.0.0' });
    const p3 = createMockPlugin('p3', '1.0.0');

    const plugins = [p1, p2, p3];
    const order = dependencyResolver.getActivationOrder(plugins);
    const orderIds = order.map((p) => p.manifest.id);

    expect(orderIds.indexOf('p3')).toBeLessThan(orderIds.indexOf('p2'));
    expect(orderIds.indexOf('p2')).toBeLessThan(orderIds.indexOf('p1'));
  });
});
