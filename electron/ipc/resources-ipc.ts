/**
 * Kubernetes Resource IPC Handlers
 *
 * Covers: pods, namespaces, generic resources, logs, describe,
 * YAML export, rollout restart, and resource deletion.
 */

import { ipcMain } from 'electron';
import { execPromise } from '../utils/exec-utils';
import { kubernetesService } from '../services/kubernetes/kubernetes-service';
import {
  wrapIpcHandler,
  assertContext,
  assertResourceType,
  assertResourceName,
  assertNamespace,
  DEFAULT_LOG_TAIL_LINES,
} from './ipc-utils';

export function registerResourcesIpcHandlers(): void {
  ipcMain.handle(
    'get-pods',
    wrapIpcHandler('get-pods', async (_event, contextName) => {
      assertContext(contextName);
      const { stdout } = await execPromise(
        `kubectl get pods --context ${contextName} -A -o json`
      );
      const data = JSON.parse(stdout);
      return data.items || [];
    })
  );

  ipcMain.handle(
    'get-namespaces',
    wrapIpcHandler('get-namespaces', async (_event, contextName) => {
      assertContext(contextName);
      const { stdout } = await execPromise(
        `kubectl get namespaces --context ${contextName} -o name`
      );
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
        if (namespace !== 'all') assertNamespace(namespace);
        const nsFlag = namespace === 'all' ? '-A' : `-n ${namespace}`;
        const { stdout } = await execPromise(
          `kubectl get ${resourceType} --context ${contextName} ${nsFlag} -o json`
        );
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
        if (namespace && namespace !== 'all') assertNamespace(namespace);
        const nsFlag =
          !namespace || namespace === 'all' ? '' : `-n ${namespace}`;
        const tail =
          Number.isInteger(tailLines) && tailLines > 0
            ? tailLines
            : DEFAULT_LOG_TAIL_LINES;
        const { stdout } = await execPromise(
          `kubectl logs ${podName} --context ${contextName} ${nsFlag} --tail=${tail}`
        );
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
        if (namespace && namespace !== 'all') assertNamespace(namespace);
        const nsFlag =
          !namespace || namespace === 'all' ? '' : `-n ${namespace}`;
        const { stdout } = await execPromise(
          `kubectl describe ${resourceType} ${resourceName} --context ${contextName} ${nsFlag}`
        );
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
        if (namespace && namespace !== 'all') assertNamespace(namespace);
        const nsFlag =
          !namespace || namespace === 'all' ? '' : `-n ${namespace}`;
        const { stdout } = await execPromise(
          `kubectl get ${resourceType} ${resourceName} --context ${contextName} ${nsFlag} -o yaml`
        );
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
        if (namespace && namespace !== 'all') assertNamespace(namespace);
        const nsFlag =
          !namespace || namespace === 'all' ? '' : `-n ${namespace}`;
        await execPromise(
          `kubectl rollout restart ${resourceType}/${resourceName} --context ${contextName} ${nsFlag}`
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
