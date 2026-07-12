import type {
  ElectronAPI,
  FolderDeleteMode,
  Manifest,
  ManifestFolder,
  PluginNotificationData,
  PluginModalData,
  PluginScaffoldOptions,
} from '../types.d';

// Stateful mock for browser testing
let mockClusters = ['minikube', 'kind-cluster-1', 'docker-desktop'];
let mockCurrentContext = 'minikube';

export const mockApi: ElectronAPI = {
  checkTool: async (tool: string) => {
    console.log('[MockAPI] checkTool:', tool);
    return { success: true, data: true };
  },
  openExternal: async (url: string) => {
    console.log('[MockAPI] openExternal:', url);
    return { success: true, data: true };
  },
  createCluster: async (name: string, provider: string) => {
    console.log('[MockAPI] createCluster:', name, provider);
    if (!mockClusters.includes(name)) {
      mockClusters.push(name);
    }
    return { success: true, data: undefined };
  },
  getClusters: async () => {
    console.log('[MockAPI] getClusters');
    return { success: true, data: [...mockClusters] };
  },
  deleteCluster: async (name: string) => {
    console.log('[MockAPI] deleteCluster:', name);
    mockClusters = mockClusters.filter((c) => c !== name);
    if (mockCurrentContext === name) {
      mockCurrentContext = mockClusters[0] || '';
    }
    return { success: true, data: undefined };
  },
  getCurrentContext: async () => {
    console.log('[MockAPI] getCurrentContext');
    return { success: true, data: mockCurrentContext };
  },
  switchContext: async (contextName: string) => {
    console.log('[MockAPI] switchContext:', contextName);
    if (mockClusters.includes(contextName)) {
      mockCurrentContext = contextName;
      return { success: true, data: true };
    }
    return { success: false, error: 'Context not found' };
  },
  getPods: async (contextName: string) => {
    console.log('[MockAPI] getPods:', contextName);
    return { success: true, data: [] };
  },
  getNamespaces: async (contextName: string) => {
    console.log('[MockAPI] getNamespaces:', contextName);
    return { success: true, data: ['default', 'kube-system'] };
  },
  getResources: async (args) => {
    console.log('[MockAPI] getResources:', args);
    return { success: true, data: [] };
  },
  getLogs: async (args) => {
    console.log('[MockAPI] getLogs:', args);
    return { success: true, data: 'Mock logs...' };
  },
  describeResource: async (args) => {
    console.log('[MockAPI] describeResource:', args);
    return { success: true, data: 'Mock description...' };
  },
  getResourceYaml: async (args) => {
    console.log('[MockAPI] getResourceYaml:', args);
    return {
      success: true,
      data: 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: mock-pod',
    };
  },
  rolloutRestart: async (args) => {
    console.log('[MockAPI] rolloutRestart:', args);
    return { success: true, data: undefined };
  },
  deleteResource: async (args) => {
    console.log('[MockAPI] deleteResource:', args);
    return { success: true, data: undefined };
  },
  scaleResource: async (args) => {
    console.log('[MockAPI] scaleResource:', args);
    return { success: true, data: undefined };
  },
  getAppVersion: async () => {
    console.log('[MockAPI] getAppVersion');
    return { success: true, data: 'v0.1.0-mock' };
  },
  getKubeconfigPath: async () => {
    console.log('[MockAPI] getKubeconfigPath');
    return { success: true, data: '/mock/kube/config' };
  },
  setKubeconfigPath: async (path: string) => {
    console.log('[MockAPI] setKubeconfigPath:', path);
    return { success: true, data: true };
  },

  // Plugin System
  getPlugins: async () => ({ success: true, data: [] }),
  enablePlugin: async (_id: string) => ({ success: true, data: true }),
  disablePlugin: async (_id: string) => ({
    success: true,
    data: [] as string[],
  }),
  checkForPluginUpdates: async () => ({ success: true, data: undefined }),
  getPluginExtensions: async (_point?: string) => ({
    success: true,
    data: [],
  }),
  executePluginAction: async (_pid: string, _aid: string, _args?: unknown) => ({
    success: true,
    data: undefined,
  }),
  getPluginSettings: async (_id: string) => ({ success: true, data: {} }),
  setPluginSettings: async (
    _id: string,
    _settings: Record<string, unknown>
  ) => ({
    success: true,
    data: true,
  }),
  uninstallPlugin: async (_id: string) => ({ success: true, data: true }),
  activatePluginLicense: async (_pid: string, _key: string) => ({
    success: true,
    data: undefined,
  }),
  startPluginTrial: async (_pid: string) => ({
    success: true,
    data: undefined,
  }),
  deactivatePluginLicense: async (_pid: string) => ({
    success: true,
    data: undefined,
  }),
  getMarketplacePlugins: async () => ({ success: true, data: [] }),
  installPlugin: async (_id: string) => ({ success: true, data: undefined }),
  createCheckout: async (_id: string) => ({
    success: true,
    data: { sessionId: 'cs_mock', url: 'https://example.com/pay' },
  }),
  getCheckoutStatus: async (_sessionId: string) => ({
    success: true,
    data: { status: 'paid' as const, licenseKey: 'LIC-MOCK' },
  }),
  generatePlugin: async (_options: PluginScaffoldOptions) => ({
    success: true,
    data: true,
  }),
  reloadPlugin: async (_id: string) => ({ success: true, data: undefined }),
  importLocalPlugin: async () => ({ success: true, data: 'mock-plugin-id' }),

  // Manifests
  getManifests: async (_clusterContext?: string) => ({
    success: true,
    data: [],
  }),
  saveManifest: async (_manifest: Partial<Manifest>) => ({
    success: true,
    data: Date.now(),
  }),
  deleteManifest: async (_id: number) => ({ success: true, data: true }),
  applyManifest: async (_id: number) => ({
    success: true,
    data: { stdout: 'Mock apply success', stderr: '' },
  }),

  // Manifest folders
  getManifestFolders: async () => ({
    success: true,
    data: [] as ManifestFolder[],
  }),
  saveManifestFolder: async (_folder: Partial<ManifestFolder>) => ({
    success: true,
    data: Date.now(),
  }),
  deleteManifestFolder: async (_id: number, _mode?: FolderDeleteMode) => ({
    success: true,
    data: true,
  }),
  moveManifest: async (_id: number, _folderId: number | null) => ({
    success: true,
    data: true,
  }),
  moveManifestFolder: async (_id: number, _parentId: number | null) => ({
    success: true,
    data: true,
  }),

  // Listeners
  onSetKubeconfigPath: (_callback: (value: boolean) => void) => {},
  onPluginNotification:
    (_callback: (data: PluginNotificationData) => void) => () => {},
  onPluginModal: (_callback: (data: PluginModalData) => void) => () => {},

  // Terminal (mock stubs — not functional in browser)
  terminalCreate: async () => ({
    success: false,
    error: 'Not available in browser',
  }),
  terminalShells: async () => ({
    success: false,
    error: 'Not available in browser',
  }),
  terminalInput: async () => ({
    success: false,
    error: 'Not available in browser',
  }),
  terminalResize: async () => ({
    success: false,
    error: 'Not available in browser',
  }),
  terminalKill: async () => ({
    success: false,
    error: 'Not available in browser',
  }),
  terminalInterrupt: async () => ({
    success: false,
    error: 'Not available in browser',
  }),
  onTerminalOutput: () => () => {},
  onTerminalExited: () => () => {},

  // Port forwarding (mock stubs — not functional in browser)
  portForwardStart: async () => ({
    success: false,
    error: 'Not available in browser',
  }),
  portForwardStop: async () => ({
    success: false,
    error: 'Not available in browser',
  }),
  portForwardList: async () => ({ success: true, data: [] }),
  onPortForwardClosed: () => () => {},
  checkForAppUpdates: async () => ({ success: true, data: false }),
  installAppUpdate: async () => ({ success: true, data: true }),
  onUpdateStatus: () => () => {},
};
