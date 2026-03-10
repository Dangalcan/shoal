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

const execPromise = util.promisify(exec);

export class KubernetesService {
  /**
   * Get resources of a specific type
   */
  async getResources(
    type: string,
    namespace: string,
    contextName?: string
  ): Promise<any[]> {
    try {
      const nsFlag = namespace === 'all' ? '-A' : `-n ${namespace}`;
      const contextFlag = contextName ? `--context ${contextName}` : '';
      const { stdout } = await execPromise(
        `kubectl get ${type} ${contextFlag} ${nsFlag} -o json`
      );
      const data = JSON.parse(stdout);
      return data.items || [];
    } catch (error: any) {
      console.error(
        `[KubernetesService] Failed to get resources: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Create a resource from manifest
   */
  async createResource(manifest: any, contextName?: string): Promise<void> {
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
    } catch (error: any) {
      console.error(
        `[KubernetesService] Failed to create resource: ${error.message}`
      );
      throw error;
    } finally {
      await fs
        .unlink(tempFile)
        .catch((e) =>
          console.warn(
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
    manifest: any,
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
    } catch (error: any) {
      console.error(
        `[KubernetesService] Failed to update resource: ${error.message}`
      );
      throw error;
    } finally {
      await fs
        .unlink(tempFile)
        .catch((e) =>
          console.warn(
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
    } catch (error: any) {
      console.error(
        `[KubernetesService] Failed to delete resource: ${error.message}`
      );
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
    } catch (error: any) {
      console.error(
        `[KubernetesService] Failed to execute command: ${error.message}`
      );
      throw error;
    }
  }
}

export const kubernetesService = new KubernetesService();
