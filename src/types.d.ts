import type { K8sResource } from './types/k8s-types';
import type { Result } from './types/result';
import type {
  Plugin,
  PluginNotificationData,
  PluginModalData,
  PluginScaffoldOptions,
} from '../electron/types/plugin-types';

export type { PluginNotificationData, PluginModalData, PluginScaffoldOptions };

export interface Manifest {
  id: number;
  name: string;
  cluster_context: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ElectronAPI {
  checkTool: (tool: string) => Promise<Result<boolean>>;
  openExternal: (url: string) => Promise<Result<boolean>>;
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
  disablePlugin: (pluginId: string) => Promise<Result<string[]>>;
  checkForPluginUpdates: () => Promise<Result<void>>;
  getPluginExtensions: (extensionPoint?: string) => Promise<Result<unknown[]>>;
  executePluginAction: (
    pluginId: string,
    actionId: string,
    args?: unknown
  ) => Promise<Result<unknown>>;
  getPluginSettings: (
    pluginId: string
  ) => Promise<Result<Record<string, unknown>>>;
  setPluginSettings: (
    pluginId: string,
    settings: Record<string, unknown>
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
  createCheckout: (
    pluginId: string
  ) => Promise<Result<{ sessionId: string; url: string }>>;
  getCheckoutStatus: (
    sessionId: string
  ) => Promise<Result<{ status: 'pending' | 'paid'; licenseKey?: string }>>;
  generatePlugin: (options: PluginScaffoldOptions) => Promise<Result<boolean>>;
  reloadPlugin: (pluginId: string) => Promise<Result<void>>;
  importLocalPlugin: () => Promise<Result<string>>;

  // Manifests
  getManifests: (clusterContext?: string) => Promise<Result<Manifest[]>>;
  saveManifest: (manifest: Partial<Manifest>) => Promise<Result<number>>;
  deleteManifest: (id: number) => Promise<Result<boolean>>;
  applyManifest: (
    id: number
  ) => Promise<Result<{ stdout: string; stderr: string }>>;

  // Terminal
  terminalCreate: (args: {
    kind: 'local' | 'pod-exec';
    podName?: string;
    namespace?: string;
    contextName?: string;
    shell?: string;
    cols?: number;
    rows?: number;
  }) => Promise<Result<{ sessionId: string }>>;
  terminalInput: (sessionId: string, data: string) => Promise<Result<boolean>>;
  terminalResize: (
    sessionId: string,
    cols: number,
    rows: number
  ) => Promise<Result<boolean>>;
  terminalKill: (sessionId: string) => Promise<Result<boolean>>;
  terminalInterrupt: (sessionId: string) => Promise<Result<boolean>>;
  onTerminalOutput: (
    callback: (sessionId: string, data: string) => void
  ) => () => void;
  onTerminalExited: (callback: (sessionId: string) => void) => () => void;

  // Listeners
  onSetKubeconfigPath: (callback: (value: boolean) => void) => void;
  onPluginNotification: (
    callback: (data: PluginNotificationData) => void
  ) => () => void;
  onPluginModal: (callback: (data: PluginModalData) => void) => () => void;
}

export interface MarketplaceEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  longDescription?: string;
  author: string;
  category: string;
  icon?: string;
  price: number;
  screenshots?: string[];
  rating?: number;
  reviews?: number;
  downloadUrl?: string;
  tags?: string[];
  featured?: boolean;
  changelog?: string;
  manifest?: {
    permissions?: string[];
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
    /** React exposed for plugin renderer scripts */
    React: typeof import('react');
    /** K8s UI component library exposed for plugin renderer scripts */
    K8sUI: Record<string, unknown>;
    /** Lucide icon library exposed for plugin renderer scripts */
    LucideIcons: Record<string, unknown>;
  }
}
