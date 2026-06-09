import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type {
  PluginNotificationData,
  PluginModalData,
  PluginScaffoldOptions,
} from './types/plugin-types';

contextBridge.exposeInMainWorld('electron', {
  runCommand: (command: string) => ipcRenderer.invoke('run-command', command),
  checkTool: (tool: string) => ipcRenderer.invoke('check-tool', tool),
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
  }) => ipcRenderer.invoke('get-logs', args),
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
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
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
  generatePlugin: (options: PluginScaffoldOptions) =>
    ipcRenderer.invoke('generate-plugin', options),
  reloadPlugin: (pluginId: string) =>
    ipcRenderer.invoke('reload-plugin', pluginId),
  importLocalPlugin: () => ipcRenderer.invoke('import-local-plugin'),

  // Manifests
  getManifests: (clusterContext?: string) =>
    ipcRenderer.invoke('get-manifests', clusterContext),
  saveManifest: (manifest: Record<string, unknown>) =>
    ipcRenderer.invoke('save-manifest', manifest),
  deleteManifest: (id: number) => ipcRenderer.invoke('delete-manifest', id),
  applyManifest: (id: number) => ipcRenderer.invoke('apply-manifest', id),

  // Terminal
  terminalCreate: (args: {
    kind: 'local' | 'pod-exec';
    podName?: string;
    namespace?: string;
    contextName?: string;
    cols?: number;
    rows?: number;
  }) => ipcRenderer.invoke('terminal:create', args),
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
});
