/**
 * Kubernetes Resource IPC Handlers
 *
 * Covers: pods, namespaces, generic resources, logs, describe,
 * YAML export, rollout restart, and resource deletion.
 *
 * Handlers validate inputs (defense in depth — the service layer validates
 * again) and execute via safeExec argument arrays; no shell is involved.
 */

import { ipcMain } from 'electron';
import { safeExec } from '../utils/safe-exec';
import { kubernetesService } from '../services/kubernetes/kubernetes-service';
import {
  wrapIpcHandler,
  assertContext,
  assertResourceType,
  assertResourceName,
  assertNamespace,
  DEFAULT_LOG_TAIL_LINES,
} from './ipc-utils';

/** Namespace args for list-style commands ('all' → -A). */
function namespaceArgs(namespace: string): string[] {
  if (namespace === 'all') return ['-A'];
  assertNamespace(namespace);
  return ['-n', namespace];
}

/** Namespace args for single-resource commands ('all'/empty → none). */
function optionalNamespaceArgs(namespace?: string): string[] {
  if (!namespace || namespace === 'all') return [];
  assertNamespace(namespace);
  return ['-n', namespace];
}

export function registerResourcesIpcHandlers(): void {
  ipcMain.handle(
    'get-pods',
    wrapIpcHandler('get-pods', async (_event, contextName) => {
      assertContext(contextName);
      const { stdout } = await safeExec('kubectl', [
        'get',
        'pods',
        '--context',
        contextName,
        '-A',
        '-o',
        'json',
      ]);
      const data = JSON.parse(stdout);
      return data.items || [];
    })
  );

  ipcMain.handle(
    'get-namespaces',
    wrapIpcHandler('get-namespaces', async (_event, contextName) => {
      assertContext(contextName);
      const { stdout } = await safeExec('kubectl', [
        'get',
        'namespaces',
        '--context',
        contextName,
        '-o',
        'name',
      ]);
      return stdout
        .trim()
        .split('\n')
        .map((ns) => ns.replace('namespace/', ''))
        .filter(Boolean);
    })
  );

  ipcMain.handle(
    'get-resources',
    wrapIpcHandler(
      'get-resources',
      async (_event, { contextName, resourceType, namespace }) => {
        assertContext(contextName);
        assertResourceType(resourceType);
        const { stdout } = await safeExec('kubectl', [
          'get',
          resourceType,
          '--context',
          contextName,
          ...namespaceArgs(namespace),
          '-o',
          'json',
        ]);
        const data = JSON.parse(stdout);
        return data.items || [];
      }
    )
  );

  ipcMain.handle(
    'get-logs',
    wrapIpcHandler(
      'get-logs',
      async (_event, { contextName, podName, namespace, tailLines }) => {
        assertContext(contextName);
        assertResourceName(podName);
        const tail =
          Number.isInteger(tailLines) && tailLines > 0
            ? tailLines
            : DEFAULT_LOG_TAIL_LINES;
        const { stdout } = await safeExec('kubectl', [
          'logs',
          podName,
          '--context',
          contextName,
          ...optionalNamespaceArgs(namespace),
          `--tail=${tail}`,
        ]);
        return stdout;
      }
    )
  );

  ipcMain.handle(
    'describe-resource',
    wrapIpcHandler(
      'describe-resource',
      async (
        _event,
        { contextName, resourceType, resourceName, namespace }
      ) => {
        assertContext(contextName);
        assertResourceType(resourceType);
        assertResourceName(resourceName);
        const { stdout } = await safeExec('kubectl', [
          'describe',
          resourceType,
          resourceName,
          '--context',
          contextName,
          ...optionalNamespaceArgs(namespace),
        ]);
        return stdout;
      }
    )
  );

  ipcMain.handle(
    'get-resource-yaml',
    wrapIpcHandler(
      'get-resource-yaml',
      async (
        _event,
        { contextName, resourceType, resourceName, namespace }
      ) => {
        assertContext(contextName);
        assertResourceType(resourceType);
        assertResourceName(resourceName);
        const { stdout } = await safeExec('kubectl', [
          'get',
          resourceType,
          resourceName,
          '--context',
          contextName,
          ...optionalNamespaceArgs(namespace),
          '-o',
          'yaml',
        ]);
        return stdout;
      }
    )
  );

  ipcMain.handle(
    'rollout-restart',
    wrapIpcHandler(
      'rollout-restart',
      async (
        _event,
        { contextName, resourceType, resourceName, namespace }
      ) => {
        assertContext(contextName);
        assertResourceType(resourceType);
        assertResourceName(resourceName);
        await safeExec('kubectl', [
          'rollout',
          'restart',
          `${resourceType}/${resourceName}`,
          '--context',
          contextName,
          ...optionalNamespaceArgs(namespace),
        ]);
      }
    )
  );

  ipcMain.handle(
    'scale-resource',
    wrapIpcHandler(
      'scale-resource',
      async (
        _event,
        { contextName, resourceType, resourceName, namespace, replicas }
      ) => {
        assertContext(contextName);
        assertResourceType(resourceType);
        assertResourceName(resourceName);
        if (namespace && namespace !== 'all') assertNamespace(namespace);
        if (!Number.isInteger(replicas) || replicas < 0) {
          throw new Error(`Invalid replica count: "${replicas}"`);
        }
        return await kubernetesService.scaleResource(
          resourceType,
          resourceName,
          namespace,
          replicas,
          contextName
        );
      }
    )
  );

  ipcMain.handle(
    'delete-resource',
    wrapIpcHandler(
      'delete-resource',
      async (
        _event,
        { contextName, resourceType, resourceName, namespace }
      ) => {
        assertContext(contextName);
        assertResourceType(resourceType);
        assertResourceName(resourceName);
        if (namespace && namespace !== 'all') assertNamespace(namespace);
        return await kubernetesService.deleteResource(
          resourceType,
          resourceName,
          namespace,
          contextName
        );
      }
    )
  );
}
