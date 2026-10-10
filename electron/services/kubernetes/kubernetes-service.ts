/**
 * Kubernetes Service
 *
 * Central service for Kubernetes operations.
 * Emits events to the plugin event bus.
 *
 * SECURITY: all inputs are validated HERE (not only in the IPC layer)
 * because this service is reachable from plugin contexts. All commands
 * run through safeExec (execFile, no shell).
 */

import path from 'path';
import fs from 'fs/promises';
import { app } from 'electron';
import { safeExec } from '../../utils/safe-exec';
import {
  assertContext,
  assertResourceType,
  assertResourceName,
  assertNamespace,
} from '../../utils/k8s-validate';
import { cleanupTempFile } from '../../utils/fs-utils';
import { getErrorMessage } from '../../utils/error-utils';
import { pluginEventBus } from '../plugins/plugin-events';
import { resourceReadCache } from './resource-read-cache';
import log from '../../logger';

/** Builds ['--context', ctx] when a context is given, validating it. */
function contextArgs(contextName?: string): string[] {
  if (!contextName) return [];
  assertContext(contextName);
  return ['--context', contextName];
}

/** Builds the namespace args, validating unless it's the "all" sentinel. */
function namespaceArgs(namespace: string): string[] {
  if (namespace === 'all') return ['-A'];
  assertNamespace(namespace);
  return ['-n', namespace];
}

/** Workloads whose replica count can be changed with `kubectl scale`. */
const SCALABLE_RESOURCE_TYPES = new Set([
  'deployments',
  'statefulsets',
  'replicasets',
]);

export interface PodMetrics {
  namespace: string;
  name: string;
  /** CPU usage in millicores (kubectl top "5m" → 5, "1" core → 1000). */
  cpuMillicores: number;
  /** Memory usage in MiB. */
  memoryMi: number;
}

/** "250m" → 250; "1" → 1000; "1.5" → 1500. */
export function parseCpuToMillicores(v: string): number {
  if (v.endsWith('m')) return parseInt(v.slice(0, -1), 10) || 0;
  const cores = parseFloat(v);
  return Number.isFinite(cores) ? Math.round(cores * 1000) : 0;
}

/** "23Mi" → 23; "1Gi" → 1024; "512Ki" → 0.5. */
export function parseMemoryToMi(v: string): number {
  const m = /^([\d.]+)(Ki|Mi|Gi|Ti)?$/.exec(v);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return 0;
  switch (m[2]) {
    case 'Ki':
      return n / 1024;
    case 'Gi':
      return n * 1024;
    case 'Ti':
      return n * 1024 * 1024;
    default:
      return n; // Mi (kubectl top default) or bare bytes-as-Mi fallback
  }
}

/**
 * Parse `kubectl top pods --no-headers` output. With -A the first column is
 * the namespace; with -n it is omitted, so the caller's namespace is used.
 */
export function parseTopPodsOutput(
  stdout: string,
  namespace: string
): PodMetrics[] {
  const all = namespace === 'all';
  return stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const cols = line.split(/\s+/);
      if (all && cols.length >= 4) {
        return {
          namespace: cols[0],
          name: cols[1],
          cpuMillicores: parseCpuToMillicores(cols[2]),
          memoryMi: parseMemoryToMi(cols[3]),
        };
      }
      if (!all && cols.length >= 3) {
        return {
          namespace,
          name: cols[0],
          cpuMillicores: parseCpuToMillicores(cols[1]),
          memoryMi: parseMemoryToMi(cols[2]),
        };
      }
      return null;
    })
    .filter((m): m is PodMetrics => m !== null);
}

/** Sanity cap to catch typos and hostile input; real clusters rarely need more. */
const MAX_REPLICAS = 1000;

export class KubernetesService {
  /**
   * Get resources of a specific type
   */
  async getResources(
    type: string,
    namespace: string,
    contextName?: string
  ): Promise<unknown[]> {
    try {
      assertResourceType(type);
      // Validate eagerly so a cache hit can never bypass validation
      const ctx = contextArgs(contextName);
      const ns = namespaceArgs(namespace);
      // Identical list reads from plugins/widgets within the TTL window
      // collapse into one kubectl invocation.
      return await resourceReadCache.getOrFetch(
        `${contextName ?? ''}|${type}|${namespace}`,
        async () => {
          const { stdout } = await safeExec('kubectl', [
            'get',
            type,
            ...ctx,
            ...ns,
            '-o',
            'json',
          ]);
          const data = JSON.parse(stdout) as Record<string, unknown>;
          return (data.items as unknown[]) || [];
        }
      );
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      log.error(`[KubernetesService] Failed to get resources: ${msg}`);
      throw error;
    }
  }

  /**
   * Create a resource from manifest
   */
  async createResource(manifest: unknown, contextName?: string): Promise<void> {
    const tempFile = path.join(
      app.getPath('temp'),
      `shoal-create-${Date.now()}.json`
    );
    try {
      await fs.writeFile(tempFile, JSON.stringify(manifest), 'utf-8');
      await safeExec('kubectl', [
        'apply',
        ...contextArgs(contextName),
        '-f',
        tempFile,
      ]);

      resourceReadCache.clear();
      // Emit event
      pluginEventBus.emitResourceCreated(manifest);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      log.error(`[KubernetesService] Failed to create resource: ${msg}`);
      throw error;
    } finally {
      await cleanupTempFile(tempFile, '[KubernetesService] create resource');
    }
  }

  /**
   * Update a resource from manifest
   */
  async updateResource(
    type: string,
    name: string,
    manifest: unknown,
    contextName?: string
  ): Promise<void> {
    const tempFile = path.join(
      app.getPath('temp'),
      `shoal-update-${Date.now()}.json`
    );
    try {
      await fs.writeFile(tempFile, JSON.stringify(manifest), 'utf-8');
      await safeExec('kubectl', [
        'apply',
        ...contextArgs(contextName),
        '-f',
        tempFile,
      ]);

      resourceReadCache.clear();
      // Emit event
      pluginEventBus.emitResourceUpdated(manifest);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      log.error(`[KubernetesService] Failed to update resource: ${msg}`);
      throw error;
    } finally {
      await cleanupTempFile(tempFile, '[KubernetesService] update resource');
    }
  }

  /**
   * Delete a resource
   */
  async deleteResource(
    type: string,
    name: string,
    namespace: string,
    contextName?: string
  ): Promise<void> {
    try {
      assertResourceType(type);
      assertResourceName(name);
      const nsArgs =
        namespace === 'all' || !namespace ? [] : namespaceArgs(namespace);
      await safeExec('kubectl', [
        'delete',
        type,
        name,
        ...contextArgs(contextName),
        ...nsArgs,
      ]);

      resourceReadCache.clear();
      // Emit event
      pluginEventBus.emitResourceDeleted({ type, name, namespace });
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      log.error(`[KubernetesService] Failed to delete resource: ${msg}`);
      throw error;
    }
  }

  /**
   * Scale a workload to a number of replicas.
   *
   * Only replica-based workloads can be scaled; the type is checked against
   * an allowlist so arbitrary resource kinds cannot be passed to kubectl.
   */
  async scaleResource(
    type: string,
    name: string,
    namespace: string,
    replicas: number,
    contextName?: string
  ): Promise<void> {
    try {
      assertResourceType(type);
      assertResourceName(name);
      if (!SCALABLE_RESOURCE_TYPES.has(type)) {
        throw new Error(`Resource type "${type}" cannot be scaled`);
      }
      if (
        !Number.isInteger(replicas) ||
        replicas < 0 ||
        replicas > MAX_REPLICAS
      ) {
        throw new Error(
          `Invalid replica count: must be an integer between 0 and ${MAX_REPLICAS}`
        );
      }
      const nsArgs =
        namespace === 'all' || !namespace ? [] : namespaceArgs(namespace);
      await safeExec('kubectl', [
        'scale',
        `${type}/${name}`,
        `--replicas=${replicas}`,
        ...contextArgs(contextName),
        ...nsArgs,
      ]);

      resourceReadCache.clear();
      pluginEventBus.emitResourceUpdated({ type, name, namespace, replicas });
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      log.error(`[KubernetesService] Failed to scale resource: ${msg}`);
      throw error;
    }
  }

  /**
   * Pod resource usage from the metrics-server (`kubectl top pods`).
   * Returns [] (not an error) when the metrics API is unavailable so callers
   * can degrade gracefully — many local clusters run without metrics-server.
   */
  async getPodMetrics(
    namespace: string,
    contextName?: string
  ): Promise<PodMetrics[]> {
    const ctx = contextArgs(contextName);
    const ns = namespaceArgs(namespace);
    try {
      return (await resourceReadCache.getOrFetch(
        `${contextName ?? ''}|top-pods|${namespace}`,
        async () => {
          const { stdout } = await safeExec('kubectl', [
            'top',
            'pods',
            ...ctx,
            ...ns,
            '--no-headers',
          ]);
          return parseTopPodsOutput(stdout, namespace);
        }
      )) as PodMetrics[];
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      if (
        /metrics|Metrics API not available|the server could not find/i.test(msg)
      ) {
        log.warn('[KubernetesService] Metrics API unavailable:', msg);
        return [];
      }
      log.error(`[KubernetesService] Failed to get pod metrics: ${msg}`);
      throw error;
    }
  }

  /**
   * Execute command in a pod.
   *
   * The command string is split on whitespace and passed after `--`, so it
   * is executed by the container runtime, never by a local shell. Quoted
   * arguments with spaces are not supported by design.
   */
  async executeCommand(
    pod: string,
    namespace: string,
    command: string,
    contextName?: string
  ): Promise<string> {
    try {
      assertResourceName(pod);
      assertNamespace(namespace);
      const commandParts = command.trim().split(/\s+/).filter(Boolean);
      if (commandParts.length === 0) {
        throw new Error('Empty command');
      }
      const { stdout } = await safeExec('kubectl', [
        'exec',
        pod,
        ...contextArgs(contextName),
        '-n',
        namespace,
        '--',
        ...commandParts,
      ]);
      return stdout;
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      log.error(`[KubernetesService] Failed to execute command: ${msg}`);
      throw error;
    }
  }
}

export const kubernetesService = new KubernetesService();
