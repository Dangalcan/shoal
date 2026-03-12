import { createContext, useContext, ReactNode } from 'react';

// ElectronAPI type is defined globally via electron.d.ts
type ElectronAPI = typeof window.electron;

/**
 * Context for accessing the Electron API throughout the application.
 * This provides dependency injection for better testability and flexibility.
 */
const ApiContext = createContext<ElectronAPI | null>(null);

interface ApiProviderProps {
  children: ReactNode;
  /** 
   * Optional API implementation for testing.
   * Defaults to window.electron in production.
   */
  api?: ElectronAPI;
}

import { mockApi } from './mockApi';

/**
 * Provider component that makes the Electron API available to all child components.
 * 
 * @example
 * ```tsx
 * // In production (App.tsx)
 * <ApiProvider>
 *   <App />
 * </ApiProvider>
 * 
 * // In tests
 * <ApiProvider api={mockApi}>
 *   <ComponentUnderTest />
 * </ApiProvider>
 * ```
 */
const IS_TEST = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

function resolveApi(provided?: ElectronAPI): ElectronAPI {
  if (provided) return provided;
  if (window.electron) return window.electron;
  if (IS_TEST) {
    return mockApi;
  }
  console.error(
    '[ApiProvider] window.electron is not available in a non-test environment. ' +
    'The Electron preload script may not have run correctly.'
  );
  // Return mock so the UI can at least render an error state instead of crashing
  return mockApi;
}

export function ApiProvider({ children, api }: ApiProviderProps) {
  const resolvedApi = resolveApi(api);
  const usingMock = resolvedApi === mockApi && !api;
  if (usingMock && !IS_TEST) {
    return (
      <div style={{ padding: '2rem', color: 'red', fontFamily: 'monospace' }}>
        <strong>Fatal:</strong> Electron IPC bridge not found. Please restart the application.
      </div>
    );
  }
  return <ApiContext.Provider value={resolvedApi}>{children}</ApiContext.Provider>;
}

/**
 * Hook to access the Electron API.
 * Must be used within an ApiProvider.
 * 
 * @throws Error if used outside of ApiProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const api = useApi();
 *   
 *   const handleClick = async () => {
 *     const result = await api.getClusters();
 *     // ...
 *   };
 * }
 * ```
 */
export function useApi(): ElectronAPI {
  const api = useContext(ApiContext);
  
  if (!api) {
    throw new Error(
      'useApi must be used within an ApiProvider. ' +
      'Wrap your component tree with <ApiProvider>.'
    );
  }
  
  return api;
}
