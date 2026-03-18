import type {
  ElectronAPI,
  Manifest,
  PluginNotificationData,
  PluginModalData,
  PluginScaffoldOptions,
} from '../types.d';

// Stateful mock for browser testing
let mockClusters = ['minikube', 'kind-cluster-1', 'docker-desktop'];
let mockCurrentContext = 'minikube';

export const mockApi: ElectronAPI = {
  runCommand: async (command: string) => {
    console.log('[MockAPI] runCommand:', command);
    return { success: true, data: { stdout: 'Mock output', stderr: '' } };
  },
  checkTool: async (tool: string) => {
    console.log('[MockAPI] checkTool:', tool);
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

  // Listeners
  onSetKubeconfigPath: (_callback: (value: boolean) => void) => {},
  onPluginNotification:
    (_callback: (data: PluginNotificationData) => void) => () => {},
  onPluginModal: (_callback: (data: PluginModalData) => void) => () => {},
};
