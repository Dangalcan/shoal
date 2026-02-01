import type { K8sResource } from './types/k8s-types';
import type { Result } from './types/result';
import type { Plugin } from '../electron/types/plugin-types';

export interface ElectronAPI {
  runCommand: (command: string) => Promise<
    Result<{
      stdout: string;
      stderr: string;
    }>
  >;
  checkTool: (tool: string) => Promise<Result<boolean>>;
  createCluster: (name: string, provider: string) => Promise<Result<void>>;
  getClusters: () => Promise<Result<string[]>>;
  deleteCluster: (name: string) => Promise<Result<void>>;
  getCurrentContext: () => Promise<Result<string>>;
  switchContext: (contextName: string) => Promise<Result<boolean>>;
  getPods: (contextName: string) => Promise<Result<K8sResource[]>>;
  getNamespaces: (contextName: string) => Promise<Result<string[]>>;
  getResources: (args: {
    contextName: string;
    resourceType: string;
    namespace: string;
  }) => Promise<Result<K8sResource[]>>;
  getLogs: (args: {
    contextName: string;
    podName: string;
    namespace: string;
    tailLines?: number;
  }) => Promise<Result<string>>;
  describeResource: (args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }) => Promise<Result<string>>;
  getResourceYaml: (args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }) => Promise<Result<string>>;
  rolloutRestart: (args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }) => Promise<Result<void>>;
  deleteResource: (args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }) => Promise<Result<void>>;
  getAppVersion: () => Promise<Result<string>>;
  getKubeconfigPath: () => Promise<Result<string>>;
  setKubeconfigPath: (path: string) => Promise<Result<boolean>>;

  // Plugin System
  getPlugins: () => Promise<Result<Plugin[]>>;
  enablePlugin: (pluginId: string) => Promise<Result<boolean>>;
  disablePlugin: (pluginId: string) => Promise<Result<void>>;
  checkForPluginUpdates: () => Promise<Result<void>>;
  getPluginExtensions: (extensionPoint?: string) => Promise<Result<any[]>>;
  executePluginAction: (
    pluginId: string,
    actionId: string,
    args?: any
  ) => Promise<Result<any>>;
  getPluginSettings: (pluginId: string) => Promise<Result<Record<string, any>>>;
  setPluginSettings: (
    pluginId: string,
    settings: Record<string, any>
  ) => Promise<Result<boolean>>;
  uninstallPlugin: (pluginId: string) => Promise<Result<boolean>>;
  activatePluginLicense: (
    pluginId: string,
    licenseKey: string
  ) => Promise<Result<void>>;
  startPluginTrial: (pluginId: string) => Promise<Result<void>>;
  deactivatePluginLicense: (pluginId: string) => Promise<Result<void>>;
  getMarketplacePlugins: () => Promise<Result<MarketplaceEntry[]>>;
  installPlugin: (pluginId: string) => Promise<Result<void>>;
  generatePlugin: (options: any) => Promise<Result<boolean>>;
  reloadPlugin: (pluginId: string) => Promise<Result<void>>;

  // Listeners
  onSetKubeconfigPath: (callback: (value: boolean) => void) => void;
  onPluginNotification: (callback: (data: any) => void) => void;
}

export interface MarketplaceEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  icon?: string;
  price: number;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
