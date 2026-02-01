import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi, beforeAll } from 'vitest';
import { mockToast } from './mocks/toast-mock';

// Import component mocks to register them globally
import './mocks/component-mocks';

// Global mocks
vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: mockToast,
}));

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock scrollIntoView and matchMedia (not available in jsdom)
if (typeof window !== 'undefined') {
  Element.prototype.scrollIntoView = vi.fn();

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Mock window.electron API with default Promise returns
const mockElectronAPI = {
  runCommand: vi
    .fn()
    .mockResolvedValue({ success: true, data: { stdout: '', stderr: '' } }),
  checkTool: vi.fn().mockResolvedValue({ success: true, data: true }),
  createCluster: vi.fn().mockResolvedValue({ success: true, data: undefined }),
  getClusters: vi.fn().mockResolvedValue({ success: true, data: [] }),
  deleteCluster: vi.fn().mockResolvedValue({ success: true, data: undefined }),
  getCurrentContext: vi.fn().mockResolvedValue({ success: true, data: 'None' }),
  getPods: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getNamespaces: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getResources: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getLogs: vi.fn().mockResolvedValue({ success: true, data: '' }),
  describeResource: vi.fn().mockResolvedValue({ success: true, data: '' }),
  getResourceYaml: vi.fn().mockResolvedValue({ success: true, data: '' }),
  rolloutRestart: vi.fn().mockResolvedValue({ success: true, data: undefined }),
  deleteResource: vi.fn().mockResolvedValue({ success: true, data: undefined }),
  getAppVersion: vi.fn().mockResolvedValue({ success: true, data: 'v0.1.0' }),

  // Plugin System
  getPlugins: vi.fn().mockResolvedValue({ success: true, data: [] }),
  enablePlugin: vi.fn().mockResolvedValue({ success: true, data: true }),
  disablePlugin: vi.fn().mockResolvedValue({ success: true, data: undefined }),
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
  getMarketplacePlugins: vi.fn().mockResolvedValue({ success: true, data: [] }),
  installPlugin: vi.fn().mockResolvedValue({ success: true, data: undefined }),
  generatePlugin: vi.fn().mockResolvedValue({ success: true, data: true }),
  reloadPlugin: vi.fn().mockResolvedValue({ success: true, data: undefined }),
};

// Set up window.electron before all tests
beforeAll(() => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'electron', {
      value: mockElectronAPI,
      writable: true,
      configurable: true,
    });
  }
});

// Export for use in tests
export { mockElectronAPI };
