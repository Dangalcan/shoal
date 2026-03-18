import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi, beforeAll } from 'vitest';
import { mockToast } from './mocks/toast-mock';
import { createMockElectronAPI } from './utils/mocks';

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

// Global clipboard mock
export const writeTextMock = vi.fn();
Object.assign(navigator, {
  clipboard: { writeText: writeTextMock },
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

// Single source of truth for the mock Electron API
export const mockElectronAPI = createMockElectronAPI();

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
