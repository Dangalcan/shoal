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

// Mock scrollIntoView (not available in jsdom)
if (typeof window !== 'undefined') {
  Element.prototype.scrollIntoView = vi.fn();
}

// Mock window.electron API with default Promise returns
const mockElectronAPI = {
  runCommand: vi
    .fn()
    .mockResolvedValue({ success: true, stdout: '', stderr: '' }),
  checkTool: vi.fn().mockResolvedValue(true),
  createCluster: vi.fn().mockResolvedValue({ success: true }),
  getClusters: vi.fn().mockResolvedValue([]),
  deleteCluster: vi.fn().mockResolvedValue({ success: true }),
  getCurrentContext: vi.fn().mockResolvedValue('None'),
  getPods: vi.fn().mockResolvedValue({ success: true, pods: [] }),
  getNamespaces: vi.fn().mockResolvedValue({ success: true, namespaces: [] }),
  getResources: vi.fn().mockResolvedValue({ success: true, items: [] }),
  getLogs: vi.fn().mockResolvedValue({ success: true, logs: '' }),
  describeResource: vi.fn().mockResolvedValue({ success: true, output: '' }),
  getResourceYaml: vi.fn().mockResolvedValue({ success: true, yaml: '' }),
  rolloutRestart: vi.fn().mockResolvedValue({ success: true }),
  deleteResource: vi.fn().mockResolvedValue({ success: true }),
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
