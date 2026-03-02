import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiProvider, useApi } from '../../services/api-context';
import { mockApi } from '../../services/mockApi';

describe('ApiContext', () => {
  const originalElectron = window.electron;

  beforeEach(() => {
    // Suppress console logs to keep test output clean
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    window.electron = originalElectron;
    vi.restoreAllMocks();
  });

  it('should throw an error when useApi is used outside ApiProvider', () => {
    // We expect the throw, so suppress React's error logging about Uncaught Error inside boundary
    const originalConsoleError = console.error;
    console.error = vi.fn();
    
    expect(() => renderHook(() => useApi())).toThrow(
      'useApi must be used within an ApiProvider. Wrap your component tree with <ApiProvider>.'
    );
    
    console.error = originalConsoleError;
  });

  it('should provide the default api (mockApi) when window.electron is missing', () => {
    delete (window as any).electron;
    
    const { result } = renderHook(() => useApi(), {
      wrapper: ({ children }) => <ApiProvider>{children}</ApiProvider>
    });
    
    expect(result.current).toBe(mockApi);
    expect(console.log).toHaveBeenCalledWith('[ApiProvider] Initializing with api:', 'Mock API');
  });

  it('should provide window.electron if it exists', () => {
    const mockWindowElectron = { ...mockApi, getClusters: vi.fn() };
    window.electron = mockWindowElectron as any;

    const { result } = renderHook(() => useApi(), {
      wrapper: ({ children }) => <ApiProvider>{children}</ApiProvider>
    });

    expect(result.current).toBe(mockWindowElectron);
    expect(console.log).toHaveBeenCalledWith('[ApiProvider] Initializing with api:', 'Electron API');
  });

  it('should accept a custom api prop', () => {
    const customApi = { ...mockApi, version: 'custom' };
    
    const { result } = renderHook(() => useApi(), {
      wrapper: ({ children }) => <ApiProvider api={customApi as any}>{children}</ApiProvider>
    });

    expect(result.current).toBe(customApi);
    expect(console.log).toHaveBeenCalledWith('[ApiProvider] Initializing with api:', 'Electron API');
  });
});
