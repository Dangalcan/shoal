import type { Result } from '../types/result';
import type {
  AppInfo,
  Manifest,
  PluginScaffoldOptions,
  RendererErrorReport,
} from '../types.d';
import type { K8sResource } from '../types/k8s-types';
import type { Plugin } from '../../electron/types/plugin-types';

export class ElectronService {
  private static instance: ElectronService;

  private constructor() {}

  public static getInstance(): ElectronService {
    if (!ElectronService.instance) {
      ElectronService.instance = new ElectronService();
    }
    return ElectronService.instance;
  }

  /**
   * Used outside the ApiProvider (ErrorBoundary, global error listeners), so
   * it must not throw when the preload bridge is missing.
   */
  async logRendererError(report: RendererErrorReport): Promise<void> {
    await window.electron?.logRendererError?.(report);
  }

  async getAppInfo(): Promise<Result<AppInfo>> {
    return window.electron.getAppInfo();
  }

  async openExternal(url: string): Promise<Result<boolean>> {
    return window.electron.openExternal(url);
  }

  async createCluster(name: string, provider: string): Promise<Result<void>> {
    return window.electron.createCluster(name, provider);
  }

  async getClusters(): Promise<Result<string[]>> {
    return window.electron.getClusters();
  }

  async deleteCluster(name: string): Promise<Result<void>> {
    return window.electron.deleteCluster(name);
  }

  async getCurrentContext(): Promise<Result<string>> {
    return window.electron.getCurrentContext();
  }

  async getPods(contextName: string): Promise<Result<K8sResource[]>> {
    return window.electron.getPods(contextName);
  }

  async getNamespaces(contextName: string): Promise<Result<string[]>> {
    return window.electron.getNamespaces(contextName);
  }

  async getResources(args: {
    contextName: string;
    resourceType: string;
    namespace: string;
  }): Promise<Result<K8sResource[]>> {
    return window.electron.getResources(args);
  }

  async getLogs(args: {
    contextName: string;
    podName: string;
    namespace: string;
    tailLines?: number;
  }): Promise<Result<string>> {
    return window.electron.getLogs(args);
  }

  async describeResource(args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }): Promise<Result<string>> {
    return window.electron.describeResource(args);
  }

  async getResourceYaml(args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }): Promise<Result<string>> {
    return window.electron.getResourceYaml(args);
  }

  async rolloutRestart(args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }): Promise<Result<void>> {
    return window.electron.rolloutRestart(args);
  }

  async deleteResource(args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }): Promise<Result<void>> {
    return window.electron.deleteResource(args);
  }

  async scaleResource(args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
    replicas: number;
  }): Promise<Result<void>> {
    return window.electron.scaleResource(args);
  }

  async checkForPluginUpdates(): Promise<Result<void>> {
    return window.electron.checkForPluginUpdates();
  }

  // Plugin System methods
  async getPlugins(): Promise<Result<Plugin[]>> {
    return window.electron.getPlugins();
  }

  async installPlugin(pluginId: string): Promise<Result<void>> {
    return window.electron.installPlugin(pluginId);
  }

  async createCheckout(
    pluginId: string
  ): Promise<Result<{ sessionId: string; url: string }>> {
    return window.electron.createCheckout(pluginId);
  }

  async getCheckoutStatus(
    sessionId: string
  ): Promise<Result<{ status: 'pending' | 'paid'; licenseKey?: string }>> {
    return window.electron.getCheckoutStatus(sessionId);
  }

  async activatePluginLicense(
    pluginId: string,
    licenseKey: string
  ): Promise<Result<void>> {
    return window.electron.activatePluginLicense(pluginId, licenseKey);
  }

  async startPluginTrial(pluginId: string): Promise<Result<void>> {
    return window.electron.startPluginTrial(pluginId);
  }

  async deactivatePluginLicense(pluginId: string): Promise<Result<void>> {
    return window.electron.deactivatePluginLicense(pluginId);
  }

  async generatePlugin(
    options: PluginScaffoldOptions
  ): Promise<Result<boolean>> {
    return window.electron.generatePlugin(options);
  }

  async reloadPlugin(pluginId: string): Promise<Result<void>> {
    return window.electron.reloadPlugin(pluginId);
  }

  // Manifests
  async saveManifest(manifest: Partial<Manifest>): Promise<Result<number>> {
    return window.electron.saveManifest(manifest);
  }
}

export const electronService = ElectronService.getInstance();
