import { vi } from 'vitest';
import type { ElectronAPI } from '../../types.d';

/**
 * Creates a mock Electron API with sensible defaults.
 * All methods return successful responses by default.
 *
 * @param overrides - Partial overrides for specific methods
 * @returns Mock Electron API object
 *
 * @example
 * ```typescript
 * const mockAPI = createMockElectronAPI({
 *   getClusters: vi.fn().mockResolvedValue(['cluster-1', 'cluster-2']),
 *   deleteCluster: vi.fn().mockResolvedValue({ success: false, error: 'Failed' }),
 * });
 *
 * window.electron = mockAPI;
 * ```
 */
export function createMockElectronAPI(
  overrides?: Partial<ElectronAPI>
): vi.Mocked<ElectronAPI> {
  return {
    checkTool: vi.fn().mockResolvedValue(true),
    openExternal: vi.fn().mockResolvedValue({ success: true, data: true }),
    createCluster: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    getClusters: vi.fn().mockResolvedValue({ success: true, data: [] }),
    deleteCluster: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    getCurrentContext: vi
      .fn()
      .mockResolvedValue({ success: true, data: 'None' }),
    switchContext: vi.fn().mockResolvedValue({ success: true, data: true }),
    getPods: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getNamespaces: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getResources: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getLogs: vi.fn().mockResolvedValue({ success: true, data: '' }),
    describeResource: vi.fn().mockResolvedValue({ success: true, data: '' }),
    getResourceYaml: vi.fn().mockResolvedValue({ success: true, data: '' }),
    rolloutRestart: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    deleteResource: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    scaleResource: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    getAppVersion: vi
      .fn()
      .mockResolvedValue({ success: true, data: '1.0.0-test' }),
    getKubeconfigPath: vi
      .fn()
      .mockResolvedValue({ success: true, data: '/path/to/kubeconfig' }),
    setKubeconfigPath: vi.fn().mockResolvedValue({ success: true, data: true }),

    // Plugin System
    getPlugins: vi.fn().mockResolvedValue({ success: true, data: [] }),
    enablePlugin: vi.fn().mockResolvedValue({ success: true, data: true }),
    disablePlugin: vi.fn().mockResolvedValue({ success: true, data: [] }),
    checkForPluginUpdates: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    getPluginExtensions: vi.fn().mockResolvedValue({ success: true, data: [] }),
    executePluginAction: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    getPluginSettings: vi.fn().mockResolvedValue({ success: true, data: {} }),
    setPluginSettings: vi.fn().mockResolvedValue({ success: true, data: true }),
    uninstallPlugin: vi.fn().mockResolvedValue({ success: true, data: true }),
    activatePluginLicense: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    startPluginTrial: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    deactivatePluginLicense: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    getMarketplacePlugins: vi
      .fn()
      .mockResolvedValue({ success: true, data: [] }),
    installPlugin: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    createCheckout: vi.fn().mockResolvedValue({
      success: true,
      data: { sessionId: 'cs_mock', url: 'https://example.com/pay' },
    }),
    getCheckoutStatus: vi.fn().mockResolvedValue({
      success: true,
      data: { status: 'paid', licenseKey: 'LIC-MOCK' },
    }),
    generatePlugin: vi.fn().mockResolvedValue({ success: true, data: true }),
    reloadPlugin: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    importLocalPlugin: vi
      .fn()
      .mockResolvedValue({ success: true, data: 'mock-plugin-id' }),

    // Manifests
    getManifests: vi.fn().mockResolvedValue({ success: true, data: [] }),
    saveManifest: vi.fn().mockResolvedValue({ success: true, data: 1 }),
    deleteManifest: vi.fn().mockResolvedValue({ success: true, data: true }),
    applyManifest: vi.fn().mockResolvedValue({
      success: true,
      data: { stdout: 'Mock apply', stderr: '' },
    }),

    // Migration
    migrationCheckKompose: vi.fn().mockResolvedValue({
      success: true,
      data: { available: true, version: '1.34.0' },
    }),
    migrationSelectComposeFile: vi.fn().mockResolvedValue({
      success: true,
      data: 'C:/project/docker-compose.yml',
    }),
    migrationConvertCompose: vi.fn().mockResolvedValue({
      success: true,
      data: { manifests: [], warnings: [], locallyBuiltImages: [] },
    }),
    migrationImportManifests: vi.fn().mockResolvedValue({
      success: true,
      data: { folderId: 1, manifestIds: [1] },
    }),

    // Manifest folders
    getManifestFolders: vi.fn().mockResolvedValue({ success: true, data: [] }),
    saveManifestFolder: vi.fn().mockResolvedValue({ success: true, data: 1 }),
    deleteManifestFolder: vi
      .fn()
      .mockResolvedValue({ success: true, data: true }),
    moveManifest: vi.fn().mockResolvedValue({ success: true, data: true }),
    moveManifestFolder: vi
      .fn()
      .mockResolvedValue({ success: true, data: true }),

    onSetKubeconfigPath: vi.fn(),
    onPluginNotification: vi.fn().mockReturnValue(() => {}),
    onPluginModal: vi.fn().mockReturnValue(() => {}),

    // Terminal API
    terminalCreate: vi
      .fn()
      .mockResolvedValue({ success: true, data: 'test-session-id' }),
    terminalShells: vi.fn().mockResolvedValue({
      success: true,
      data: {
        shells: [
          { id: 'powershell', label: 'PowerShell', family: 'windows' },
          { id: 'cmd', label: 'Command Prompt', family: 'windows' },
          { id: 'wsl', label: 'WSL', family: 'unix' },
        ],
        defaultShell: 'powershell',
      },
    }),
    terminalInput: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    terminalResize: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    terminalKill: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    terminalInterrupt: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    onTerminalOutput: vi.fn().mockReturnValue(() => {}),
    onTerminalExited: vi.fn().mockReturnValue(() => {}),
    portForwardStart: vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'fwd-1',
        contextName: 'kind-test',
        namespace: 'default',
        resourceType: 'pod',
        resourceName: 'my-pod',
        localPort: 8080,
        remotePort: 80,
        startedAt: '2026-01-01T00:00:00.000Z',
      },
    }),
    portForwardStop: vi.fn().mockResolvedValue({ success: true, data: true }),
    portForwardList: vi.fn().mockResolvedValue({ success: true, data: [] }),
    onPortForwardClosed: vi.fn().mockReturnValue(() => {}),
    checkForAppUpdates: vi
      .fn()
      .mockResolvedValue({ success: true, data: false }),
    installAppUpdate: vi.fn().mockResolvedValue({ success: true, data: true }),
    onUpdateStatus: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  };
}

/**
 * Resets all mocks to their initial state.
 * Call this in beforeEach to ensure test isolation.
 */
export function resetAllMocks() {
  vi.clearAllMocks();
}
