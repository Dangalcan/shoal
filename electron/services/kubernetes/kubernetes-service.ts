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
      const { stdout } = await safeExec('kubectl', [
        'get',
        type,
        ...contextArgs(contextName),
        ...namespaceArgs(namespace),
        '-o',
        'json',
      ]);
      const data = JSON.parse(stdout) as Record<string, unknown>;
      return (data.items as unknown[]) || [];
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
      `k8s-desktop-create-${Date.now()}.json`
    );
    try {
      await fs.writeFile(tempFile, JSON.stringify(manifest), 'utf-8');
      await safeExec('kubectl', [
        'apply',
        ...contextArgs(contextName),
        '-f',
        tempFile,
      ]);

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
      `k8s-desktop-update-${Date.now()}.json`
    );
    try {
      await fs.writeFile(tempFile, JSON.stringify(manifest), 'utf-8');
      await safeExec('kubectl', [
        'apply',
        ...contextArgs(contextName),
        '-f',
        tempFile,
      ]);

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

      // Emit event
      pluginEventBus.emitResourceDeleted({ type, name, namespace });
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      log.error(`[KubernetesService] Failed to delete resource: ${msg}`);
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
