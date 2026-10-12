import { renderHook, render } from '@testing-library/react';
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
      wrapper: ({ children }) => <ApiProvider>{children}</ApiProvider>,
    });

    expect(result.current).toBe(mockApi);
  });

  it('should provide window.electron if it exists', () => {
    const mockWindowElectron = { ...mockApi, getClusters: vi.fn() };
    window.electron = mockWindowElectron as any;

    const { result } = renderHook(() => useApi(), {
      wrapper: ({ children }) => <ApiProvider>{children}</ApiProvider>,
    });

    expect(result.current).toBe(mockWindowElectron);
  });

  it('should accept a custom api prop', () => {
    const customApi = { ...mockApi, version: 'custom' };

    const { result } = renderHook(() => useApi(), {
      wrapper: ({ children }) => (
        <ApiProvider api={customApi as any}>{children}</ApiProvider>
      ),
    });

    expect(result.current).toBe(customApi);
  });
  describe('non-test environment', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      vi.resetModules();
    });

    it('should log error and return fallback UI when window.electron is missing outside tests', async () => {
      process.env.NODE_ENV = 'production';
      delete (window as any).electron;

      // Need to re-import the module to re-evaluate the IS_TEST constant
      vi.resetModules();
      const { ApiProvider } = await import('../../services/api-context');

      const { container } = render(
        <ApiProvider>
          <div>App Content</div>
        </ApiProvider>
      );

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'window.electron is not available in a non-test environment'
        )
      );
      expect(container.textContent).toContain('Fatal:');
      expect(container.textContent).toContain('Electron IPC bridge not found');
    });
  });
});
