import { contextBridge, ipcRenderer } from 'electron';

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
    const handler = (_event: any, value: boolean) => callback(value);
    ipcRenderer.on('set-kubeconfig-path', handler);
    return () => ipcRenderer.off('set-kubeconfig-path', handler);
  },
  onPluginNotification: (callback: (data: any) => void) => {
    const handler = (_event: any, value: any) => callback(value);
    ipcRenderer.on('plugin-notification', handler);
    return () => ipcRenderer.off('plugin-notification', handler);
  },
  onPluginModal: (callback: (data: any) => void) => {
    const handler = (_event: any, value: any) => callback(value);
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
  executePluginAction: (pluginId: string, actionId: string, args?: any) =>
    ipcRenderer.invoke('execute-plugin-action', { pluginId, actionId, args }),
  getPluginSettings: (pluginId: string) =>
    ipcRenderer.invoke('get-plugin-settings', pluginId),
  setPluginSettings: (pluginId: string, settings: Record<string, any>) =>
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
  generatePlugin: (options: any) =>
    ipcRenderer.invoke('generate-plugin', options),
  reloadPlugin: (pluginId: string) =>
    ipcRenderer.invoke('reload-plugin', pluginId),
  importLocalPlugin: () => ipcRenderer.invoke('import-local-plugin'),

  // Manifests
  getManifests: (clusterContext?: string) =>
    ipcRenderer.invoke('get-manifests', clusterContext),
  saveManifest: (manifest: any) =>
    ipcRenderer.invoke('save-manifest', manifest),
  deleteManifest: (id: number) => ipcRenderer.invoke('delete-manifest', id),
  applyManifest: (id: number) => ipcRenderer.invoke('apply-manifest', id),
});
