/**
 * Dependency Resolver
 *
 * Validates and resolves plugin dependencies.
 * Ensures plugins are activated in the correct order.
 */

import semver from 'semver';
import type {
  Plugin,
  DependencyValidationResult,
} from '../../types/plugin-types';

export class DependencyResolver {
  /**
   * Validate plugin dependencies
   */
  validateDependencies(
    plugin: Plugin,
    availablePlugins: Map<string, Plugin>
  ): DependencyValidationResult {
    const result: DependencyValidationResult = {
      valid: true,
      missing: [],
      incompatible: [],
      circular: [],
    };

    if (!plugin.manifest.dependencies) {
      return result;
    }

    // Check for missing and incompatible dependencies
    for (const [depId, versionConstraint] of Object.entries(
      plugin.manifest.dependencies
    )) {
      const depPlugin = availablePlugins.get(depId);

      if (!depPlugin) {
        result.missing.push(depId);
        result.valid = false;
      } else {
        // Check version compatibility
        if (!semver.satisfies(depPlugin.manifest.version, versionConstraint)) {
          result.incompatible.push({
            pluginId: depId,
            required: versionConstraint,
            installed: depPlugin.manifest.version,
          });
          result.valid = false;
        }
      }
    }

    // Check for circular dependencies
    const circular = this.detectCircularDependencies(plugin, availablePlugins);
    if (circular.length > 0) {
      result.circular = circular;
      result.valid = false;
    }

    return result;
  }

  /**
   * Get activation order for plugins (topological sort)
   */
  getActivationOrder(plugins: Plugin[]): Plugin[] {
    const pluginMap = new Map(plugins.map((p) => [p.manifest.id, p]));
    const visited = new Set<string>();
    const sorted: Plugin[] = [];

    const visit = (plugin: Plugin) => {
      if (visited.has(plugin.manifest.id)) return;
      visited.add(plugin.manifest.id);

      // Visit dependencies first
      if (plugin.manifest.dependencies) {
        for (const depId of Object.keys(plugin.manifest.dependencies)) {
          const dep = pluginMap.get(depId);
          if (dep) visit(dep);
        }
      }

      sorted.push(plugin);
    };

    plugins.forEach(visit);
    return sorted;
  }

  /**
   * Detect circular dependencies
   */
  private detectCircularDependencies(
    plugin: Plugin,
    availablePlugins: Map<string, Plugin>,
    visited: Set<string> = new Set(),
    path: string[] = []
  ): string[][] {
    const circular: string[][] = [];
    const pluginId = plugin.manifest.id;

    if (path.includes(pluginId)) {
      // Found circular dependency
      const cycleStart = path.indexOf(pluginId);
      circular.push([...path.slice(cycleStart), pluginId]);
      return circular;
    }

    if (visited.has(pluginId)) return circular;
    visited.add(pluginId);

    if (plugin.manifest.dependencies) {
      for (const depId of Object.keys(plugin.manifest.dependencies)) {
        const dep = availablePlugins.get(depId);
        if (dep) {
          const depCircular = this.detectCircularDependencies(
            dep,
            availablePlugins,
            visited,
            [...path, pluginId]
          );
          circular.push(...depCircular);
        }
      }
    }

    return circular;
  }

  /**
   * Get all plugins that depend on a specific plugin
   */
  getDependents(pluginId: string, allPlugins: Plugin[]): Plugin[] {
    return allPlugins.filter((p) => {
      const deps = p.manifest.dependencies;
      return deps && Object.keys(deps).includes(pluginId);
    });
  }
}

export const dependencyResolver = new DependencyResolver();
