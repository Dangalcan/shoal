import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type {
  PluginNotificationData,
  PluginModalData,
  PluginScaffoldOptions,
} from './types/plugin-types';
import type { MigrationImportArgs } from './types/migration-types';

contextBridge.exposeInMainWorld('electron', {
  checkTool: (tool: string) => ipcRenderer.invoke('check-tool', tool),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  createCluster: (name: string, provider: string) =>
    ipcRenderer.invoke('create-cluster', { name, provider }),
  getClusters: () => ipcRenderer.invoke('get-clusters'),
  deleteCluster: (name: string) => ipcRenderer.invoke('delete-cluster', name),
  getCurrentContext: () => ipcRenderer.invoke('get-current-context'),
  switchContext: (contextName: string) =>
    ipcRenderer.invoke('switch-context', contextName),
  getPods: (contextName: string) => ipcRenderer.invoke('get-pods', contextName),
  getNamespaces: (contextName: string) =>
    ipcRenderer.invoke('get-namespaces', contextName),
  getResources: (args: {
    contextName: string;
    resourceType: string;
    namespace: string;
  }) => ipcRenderer.invoke('get-resources', args),
  getLogs: (args: {
    contextName: string;
    podName: string;
    namespace: string;
    tailLines?: number;
    container?: string;
    timestamps?: boolean;
    sinceSeconds?: number;
  }) => ipcRenderer.invoke('get-logs', args),
  getPodMetrics: (args: { contextName: string; namespace: string }) =>
    ipcRenderer.invoke('get-pod-metrics', args),
  describeResource: (args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }) => ipcRenderer.invoke('describe-resource', args),
  getResourceYaml: (args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }) => ipcRenderer.invoke('get-resource-yaml', args),
  rolloutRestart: (args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }) => ipcRenderer.invoke('rollout-restart', args),
  deleteResource: (args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }) => ipcRenderer.invoke('delete-resource', args),
  scaleResource: (args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
    replicas: number;
  }) => ipcRenderer.invoke('scale-resource', args),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getFeatureFlags: () => ipcRenderer.invoke('get-feature-flags'),
  getKubeconfigPath: () => ipcRenderer.invoke('get-kubeconfig-path'),
  setKubeconfigPath: (path: string) =>
    ipcRenderer.invoke('set-kubeconfig-path', path),
  onSetKubeconfigPath: (callback: (value: boolean) => void) => {
    const handler = (_event: IpcRendererEvent, value: boolean) =>
      callback(value);
    ipcRenderer.on('set-kubeconfig-path', handler);
    return () => ipcRenderer.off('set-kubeconfig-path', handler);
  },
  onPluginNotification: (callback: (data: PluginNotificationData) => void) => {
    const handler = (_event: IpcRendererEvent, value: PluginNotificationData) =>
      callback(value);
    ipcRenderer.on('plugin-notification', handler);
    return () => ipcRenderer.off('plugin-notification', handler);
  },
  onPluginModal: (callback: (data: PluginModalData) => void) => {
    const handler = (_event: IpcRendererEvent, value: PluginModalData) =>
      callback(value);
    ipcRenderer.on('plugin-modal', handler);
    return () => ipcRenderer.off('plugin-modal', handler);
  },

  // Plugin System
  getPlugins: () => ipcRenderer.invoke('get-plugins'),
  enablePlugin: (pluginId: string) =>
    ipcRenderer.invoke('enable-plugin', pluginId),
  disablePlugin: (pluginId: string) =>
    ipcRenderer.invoke('disable-plugin', pluginId),
  checkForPluginUpdates: () => ipcRenderer.invoke('check-for-plugin-updates'),
  getPluginExtensions: (extensionPoint?: string) =>
    ipcRenderer.invoke('get-plugin-extensions', extensionPoint),
  executePluginAction: (pluginId: string, actionId: string, args?: unknown) =>
    ipcRenderer.invoke('execute-plugin-action', { pluginId, actionId, args }),
  getPluginSettings: (pluginId: string) =>
    ipcRenderer.invoke('get-plugin-settings', pluginId),
  setPluginSettings: (pluginId: string, settings: Record<string, unknown>) =>
    ipcRenderer.invoke('set-plugin-settings', { pluginId, settings }),
  uninstallPlugin: (pluginId: string) =>
    ipcRenderer.invoke('uninstall-plugin', pluginId),
  activatePluginLicense: (pluginId: string, licenseKey: string) =>
    ipcRenderer.invoke('activate-plugin-license', { pluginId, licenseKey }),
  startPluginTrial: (pluginId: string) =>
    ipcRenderer.invoke('start-plugin-trial', pluginId),
  deactivatePluginLicense: (pluginId: string) =>
    ipcRenderer.invoke('deactivate-plugin-license', pluginId),
  getMarketplacePlugins: () => ipcRenderer.invoke('get-marketplace-plugins'),
  installPlugin: (pluginId: string) =>
    ipcRenderer.invoke('install-plugin', pluginId),
  createCheckout: (pluginId: string) =>
    ipcRenderer.invoke('create-checkout', pluginId),
  getCheckoutStatus: (sessionId: string) =>
    ipcRenderer.invoke('get-checkout-status', sessionId),
  generatePlugin: (options: PluginScaffoldOptions) =>
    ipcRenderer.invoke('generate-plugin', options),
  reloadPlugin: (pluginId: string) =>
    ipcRenderer.invoke('reload-plugin', pluginId),
  importLocalPlugin: () => ipcRenderer.invoke('import-local-plugin'),

  // Helm
  helmInstall: (args: {
    contextName: string;
    namespace: string;
    releaseName: string;
    chart: string;
    version?: string;
    values?: string;
    createNamespace?: boolean;
  }) => ipcRenderer.invoke('helm:install', args),
  helmUpgrade: (args: {
    contextName: string;
    namespace: string;
    releaseName: string;
    chart: string;
    version?: string;
    values?: string;
  }) => ipcRenderer.invoke('helm:upgrade', args),
  helmRollback: (args: {
    contextName: string;
    namespace: string;
    releaseName: string;
    revision: number;
  }) => ipcRenderer.invoke('helm:rollback', args),
  helmUninstall: (args: {
    contextName: string;
    namespace: string;
    releaseName: string;
  }) => ipcRenderer.invoke('helm:uninstall', args),
  helmRepoAdd: (args: { name: string; url: string }) =>
    ipcRenderer.invoke('helm:repo-add', args),
  helmRepoList: () => ipcRenderer.invoke('helm:repo-list'),

  // Manifests
  getManifests: (clusterContext?: string) =>
    ipcRenderer.invoke('get-manifests', clusterContext),
  saveManifest: (manifest: Record<string, unknown>) =>
    ipcRenderer.invoke('save-manifest', manifest),
  deleteManifest: (id: number) => ipcRenderer.invoke('delete-manifest', id),
  applyManifest: (id: number) => ipcRenderer.invoke('apply-manifest', id),

  // Manifest folders
  getManifestFolders: () => ipcRenderer.invoke('get-manifest-folders'),
  saveManifestFolder: (folder: Record<string, unknown>) =>
    ipcRenderer.invoke('save-manifest-folder', folder),
  deleteManifestFolder: (id: number, mode?: string) =>
    ipcRenderer.invoke('delete-manifest-folder', id, mode),
  moveManifest: (id: number, folderId: number | null) =>
    ipcRenderer.invoke('move-manifest', id, folderId),
  moveManifestFolder: (id: number, parentId: number | null) =>
    ipcRenderer.invoke('move-manifest-folder', id, parentId),

  // Migration (Docker Compose → Kubernetes)
  migrationCheckKompose: () => ipcRenderer.invoke('migration:check-kompose'),
  migrationSelectComposeFile: () =>
    ipcRenderer.invoke('migration:select-compose-file'),
  migrationConvertCompose: (filePath: string) =>
    ipcRenderer.invoke('migration:convert', filePath),
  migrationImportManifests: (args: MigrationImportArgs) =>
    ipcRenderer.invoke('migration:import', args),

  // Terminal
  terminalCreate: (args: {
    kind: 'local' | 'pod-exec';
    podName?: string;
    namespace?: string;
    contextName?: string;
    shell?: string;
    cols?: number;
    rows?: number;
  }) => ipcRenderer.invoke('terminal:create', args),
  terminalShells: () => ipcRenderer.invoke('terminal:shells'),

  // Port forwarding
  portForwardStart: (args: {
    contextName: string;
    namespace: string;
    resourceType: 'pod' | 'service';
    resourceName: string;
    localPort: number;
    remotePort: number;
  }) => ipcRenderer.invoke('portforward:start', args),
  portForwardStop: (id: string) =>
    ipcRenderer.invoke('portforward:stop', { id }),
  portForwardList: () => ipcRenderer.invoke('portforward:list'),
  onPortForwardClosed: (callback: (info: unknown, error?: string) => void) => {
    const handler = (
      _event: IpcRendererEvent,
      { info, error }: { info: unknown; error?: string }
    ) => callback(info, error);
    ipcRenderer.on('portforward:closed', handler);
    return () => ipcRenderer.off('portforward:closed', handler);
  },
  terminalInput: (sessionId: string, data: string) =>
    ipcRenderer.invoke('terminal:input', { sessionId, data }),
  terminalResize: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', { sessionId, cols, rows }),
  terminalKill: (sessionId: string) =>
    ipcRenderer.invoke('terminal:kill', { sessionId }),
  terminalInterrupt: (sessionId: string) =>
    ipcRenderer.invoke('terminal:interrupt', { sessionId }),
  onTerminalOutput: (callback: (sessionId: string, data: string) => void) => {
    const handler = (
      _event: IpcRendererEvent,
      { sessionId, data }: { sessionId: string; data: string }
    ) => callback(sessionId, data);
    ipcRenderer.on('terminal:output', handler);
    return () => ipcRenderer.off('terminal:output', handler);
  },
  onTerminalExited: (callback: (sessionId: string) => void) => {
    const handler = (
      _event: IpcRendererEvent,
      { sessionId }: { sessionId: string }
    ) => callback(sessionId);
    ipcRenderer.on('terminal:exited', handler);
    return () => ipcRenderer.off('terminal:exited', handler);
  },

  // App updates
  checkForAppUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installAppUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback: (status: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, status: unknown) =>
      callback(status);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.off('update-status', handler);
  },
});
