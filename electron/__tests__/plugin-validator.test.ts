import { describe, it, expect } from 'vitest';
import { validateManifest } from '../services/plugins/plugin-validator';
import {
  PLUGIN_PERMISSIONS,
  isPluginPermission,
  permissionDeniedMessage,
} from '../shared/plugin-permissions';
import {
  KUBERNETES_METHOD_PERMISSION,
  assertPluginPermission,
} from '../services/plugins/plugin-permissions';
import type {
  KubernetesAPI,
  PluginManifest,
  PluginPermission,
} from '../types/plugin-types';

const manifest = (permissions: string[]): PluginManifest => ({
  id: 'p1',
  name: 'P1',
  version: '1.0.0',
  description: 'D',
  author: 'A',
  main: 'index.js',
  permissions: permissions as PluginPermission[],
  license: { type: 'free', spdx: 'MIT' },
});

describe('validateManifest permissions', () => {
  it('accepts every permission of the shared list', () => {
    expect(validateManifest(manifest([...PLUGIN_PERMISSIONS]))).toBeNull();
    expect(validateManifest(manifest([]))).toBeNull();
  });

  it.each(['filesystem', 'network', 'notifications', 'kubernetes:read'])(
    'rejects "%s" and names the valid permissions',
    (permission) => {
      expect(validateManifest(manifest(['ui', permission]))).toBe(
        `Invalid permission: ${permission} (valid: ${PLUGIN_PERMISSIONS.join(', ')})`
      );
    }
  );

  it('requires kubernetes alongside secrets', () => {
    expect(validateManifest(manifest(['secrets']))).toBe(
      'The "secrets" permission requires "kubernetes"'
    );
    expect(validateManifest(manifest(['kubernetes', 'secrets']))).toBeNull();
  });
});

describe('plugin permission helpers', () => {
  it('recognises the shared list and nothing else', () => {
    expect(PLUGIN_PERMISSIONS).toEqual([
      'kubernetes',
      'kubernetes:write',
      'helm',
      'secrets',
      'ui',
      'storage',
    ]);
    for (const permission of PLUGIN_PERMISSIONS) {
      expect(isPluginPermission(permission)).toBe(true);
    }
    expect(isPluginPermission('network')).toBe(false);
    expect(isPluginPermission(undefined)).toBe(false);
  });

  it('maps every context.kubernetes method to a read or write permission', () => {
    const methods: Array<keyof KubernetesAPI> = [
      'getResources',
      'getPodMetrics',
      'watchResources',
      'createResource',
      'updateResource',
      'deleteResource',
      'executeCommand',
    ];
    expect(Object.keys(KUBERNETES_METHOD_PERMISSION).sort()).toEqual(
      [...methods].sort()
    );
    expect(
      methods.filter((m) => KUBERNETES_METHOD_PERMISSION[m] === 'kubernetes')
    ).toEqual(['getResources', 'getPodMetrics', 'watchResources']);
    expect(
      methods.filter(
        (m) => KUBERNETES_METHOD_PERMISSION[m] === 'kubernetes:write'
      )
    ).toEqual([
      'createResource',
      'updateResource',
      'deleteResource',
      'executeCommand',
    ]);
  });

  it('throws the standard message when a permission is missing', () => {
    expect(() =>
      assertPluginPermission(['kubernetes'], 'helm', 'helm.install')
    ).toThrow(permissionDeniedMessage('helm.install', 'helm'));
    expect(permissionDeniedMessage('helm.install', 'helm')).toBe(
      'Permission denied: "helm.install" requires the "helm" permission'
    );
    expect(() =>
      assertPluginPermission(['kubernetes', 'helm'], 'helm', 'helm.install')
    ).not.toThrow();
  });
});
