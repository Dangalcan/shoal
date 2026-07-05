/**
 * Plugin Validator
 *
 * Validates plugin manifests and constructs error-state plugin instances.
 * Kept separate from the loader so validation logic can be tested in isolation.
 */

import semver from 'semver';
import type { PluginManifest, Plugin } from '../../types/plugin-types';

const VALID_PERMISSIONS = [
  'kubernetes',
  'filesystem',
  'network',
  'ui',
  'storage',
  'notifications',
];

const VALID_LICENSE_TYPES = ['free', 'paid', 'trial', 'subscription'];

/**
 * Validates a plugin manifest.
 * Returns null on success, or a human-readable error string on failure.
 */
/** Plugin IDs: alphanumeric, hyphen, underscore only. */
const PLUGIN_ID_RE = /^[a-z0-9-_]+$/i;

/** True if `id` is a safe plugin identifier (also safe as a path segment). */
export function isValidPluginId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && PLUGIN_ID_RE.test(id);
}

/**
 * Throws if `id` is not a safe plugin identifier. Use before building any
 * filesystem path from an untrusted plugin id (prevents `../` traversal).
 */
export function assertValidPluginId(id: unknown): asserts id is string {
  if (!isValidPluginId(id)) {
    throw new Error(`Invalid plugin ID: "${String(id)}"`);
  }
}

export function validateManifest(manifest: PluginManifest): string | null {
  if (!manifest.id) return 'Missing required field: id';
  if (!manifest.name) return 'Missing required field: name';
  if (!manifest.version) return 'Missing required field: version';
  if (!manifest.description) return 'Missing required field: description';
  if (!manifest.author) return 'Missing required field: author';
  if (!manifest.main) return 'Missing required field: main';
  if (!manifest.permissions) return 'Missing required field: permissions';
  if (!manifest.license) return 'Missing required field: license';

  if (!/^[a-z0-9-_]+$/i.test(manifest.id)) {
    return 'Invalid plugin ID format (use alphanumeric, hyphens, and underscores only)';
  }

  if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
    return 'Invalid version format (use semver: x.y.z)';
  }

  for (const permission of manifest.permissions) {
    if (!VALID_PERMISSIONS.includes(permission)) {
      return `Invalid permission: ${permission}`;
    }
  }

  if (!VALID_LICENSE_TYPES.includes(manifest.license.type)) {
    return `Invalid license type: ${manifest.license.type}`;
  }

  if (
    manifest.license.type === 'paid' ||
    manifest.license.type === 'subscription'
  ) {
    if (!manifest.license.pricing) {
      return 'Paid plugins must include pricing information';
    }
    if (
      !manifest.license.pricing.price ||
      manifest.license.pricing.price <= 0
    ) {
      return 'Invalid pricing: price must be greater than 0';
    }
    if (!manifest.license.pricing.currency) {
      return 'Invalid pricing: currency is required';
    }
  }

  if (manifest.dependencies) {
    for (const [depId, versionConstraint] of Object.entries(
      manifest.dependencies
    )) {
      if (!/^[a-z0-9-_]+$/i.test(depId)) {
        return `Invalid dependency ID format: ${depId}`;
      }
      if (!semver.validRange(versionConstraint)) {
        return `Invalid version constraint for ${depId}: ${versionConstraint}`;
      }
    }
  }

  return null;
}

/** Creates a Plugin instance in the 'error' state for a manifest that failed validation. */
export function createErrorPlugin(
  manifest: Partial<PluginManifest>,
  error: string
): Plugin {
  return {
    manifest: {
      id: manifest.id || 'unknown',
      name: manifest.name || 'Unknown Plugin',
      version: manifest.version || '0.0.0',
      description: manifest.description || '',
      author: manifest.author || 'Unknown',
      main: manifest.main || 'index.js',
      permissions: manifest.permissions || [],
      license: manifest.license || { type: 'free', spdx: 'UNLICENSED' },
    },
    state: 'error',
    error,
    installedAt: new Date().toISOString(),
  };
}
