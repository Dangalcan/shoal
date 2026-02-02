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
