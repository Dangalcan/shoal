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
export function ApiProvider({ children, api = window.electron }: ApiProviderProps) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
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
