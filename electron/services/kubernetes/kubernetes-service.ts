/**
 * Kubernetes Service
 *
 * Central service for Kubernetes operations.
 * Emits events to the plugin event bus.
 */

import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs/promises';
import { app } from 'electron';
import { pluginEventBus } from '../plugins/plugin-events';
import log from '../../logger';

const execPromise = util.promisify(exec);

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
      const nsFlag = namespace === 'all' ? '-A' : `-n ${namespace}`;
      const contextFlag = contextName ? `--context ${contextName}` : '';
      const { stdout } = await execPromise(
        `kubectl get ${type} ${contextFlag} ${nsFlag} -o json`
      );
      const data = JSON.parse(stdout) as Record<string, unknown>;
      return (data.items as unknown[]) || [];
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
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
      const contextFlag = contextName ? `--context ${contextName}` : '';
      await execPromise(`kubectl apply ${contextFlag} -f ${tempFile}`);

      // Emit event
      pluginEventBus.emitResourceCreated(manifest);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error(`[KubernetesService] Failed to create resource: ${msg}`);
      throw error;
    } finally {
      await fs
        .unlink(tempFile)
        .catch((e) =>
          log.warn(
            `[KubernetesService] Failed to clean up temp file ${tempFile}:`,
            e
          )
        );
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
      const contextFlag = contextName ? `--context ${contextName}` : '';
      await execPromise(`kubectl apply ${contextFlag} -f ${tempFile}`);

      // Emit event
      pluginEventBus.emitResourceUpdated(manifest);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error(`[KubernetesService] Failed to update resource: ${msg}`);
      throw error;
    } finally {
      await fs
        .unlink(tempFile)
        .catch((e) =>
          log.warn(
            `[KubernetesService] Failed to clean up temp file ${tempFile}:`,
            e
          )
        );
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
      const nsFlag = namespace === 'all' || !namespace ? '' : `-n ${namespace}`;
      const contextFlag = contextName ? `--context ${contextName}` : '';
      await execPromise(
        `kubectl delete ${type} ${name} ${contextFlag} ${nsFlag}`
      );

      // Emit event
      pluginEventBus.emitResourceDeleted({ type, name, namespace });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error(`[KubernetesService] Failed to delete resource: ${msg}`);
      throw error;
    }
  }

  /**
   * Execute command in a pod
   */
  async executeCommand(
    pod: string,
    namespace: string,
    command: string,
    contextName?: string
  ): Promise<string> {
    try {
      const contextFlag = contextName ? `--context ${contextName}` : '';
      const { stdout } = await execPromise(
        `kubectl exec ${pod} ${contextFlag} -n ${namespace} -- ${command}`
      );
      return stdout;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error(`[KubernetesService] Failed to execute command: ${msg}`);
      throw error;
    }
  }
}

export const kubernetesService = new KubernetesService();
