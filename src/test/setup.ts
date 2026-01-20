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
    .mockResolvedValue({ success: true, data: { stdout: '', stderr: '' } }),
  checkTool: vi.fn().mockResolvedValue(true),
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
