/**
 * Plugin Provider Context
 *
 * Provides plugin state and management functions to the React application.
 */

import {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useState,
} from 'react';
import type {
  Plugin,
  PluginScaffoldOptions,
} from '../../../electron/types/plugin-types';
import { useApi } from '../../services/api-context';
import { usePluginActions } from './usePluginActions';

interface PluginContextType {
  plugins: Plugin[];
  loading: boolean;
  error: string | null;
  refreshPlugins: () => Promise<void>;
  enablePlugin: (pluginId: string) => Promise<void>;
  disablePlugin: (pluginId: string) => Promise<void>;
  getPluginExtensions: (extensionPoint?: string) => Promise<unknown[]>;
  executePluginAction: (
    pluginId: string,
    actionId: string,
    args?: unknown
  ) => Promise<unknown>;
  activateLicense: (pluginId: string, key: string) => Promise<void>;
  startTrial: (pluginId: string) => Promise<void>;
  deactivateLicense: (pluginId: string) => Promise<void>;
  installPlugin: (pluginId: string) => Promise<void>;
  getSettings: (pluginId: string) => Promise<Record<string, unknown>>;
  saveSettings: (
    pluginId: string,
    settings: Record<string, unknown>
  ) => Promise<void>;
  checkForUpdates: () => Promise<void>;
  generatePlugin: (options: PluginScaffoldOptions) => Promise<void>;
  reloadPlugin: (pluginId: string) => Promise<void>;
  uninstallPlugin: (pluginId: string) => Promise<void>;
  importLocalPlugin: () => Promise<void>;
}

const PluginContext = createContext<PluginContextType | null>(null);

interface PluginProviderProps {
  children: ReactNode;
}

export function PluginProvider({ children }: PluginProviderProps) {
  const api = useApi();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshPlugins = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getPlugins();
      if (result.success) {
        setPlugins(result.data);
      } else {
        setError(result.error || 'Failed to load plugins');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load plugins');
    } finally {
      setLoading(false);
    }
  };

  const actions = usePluginActions(plugins, refreshPlugins);

  // Load plugins on mount
  useEffect(() => {
    refreshPlugins();
    actions.checkForUpdates();
  }, []);

  // Plugins keep activating after the window opens, and can be reloaded or
  // fail later: follow the main process so the list and the sidebar catch up.
  useEffect(() => {
    const unsubscribe = api.onPluginStateChanged?.(() => {
      void refreshPlugins();
    });
    return () => unsubscribe?.();
  }, []);

  const value: PluginContextType = {
    plugins,
    loading,
    error,
    refreshPlugins,
    ...actions,
  };

  return (
    <PluginContext.Provider value={value}>{children}</PluginContext.Provider>
  );
}

/**
 * Hook to access plugin context
 */
export function usePlugins(): PluginContextType {
  const context = useContext(PluginContext);
  if (!context) {
    throw new Error('usePlugins must be used within a PluginProvider');
  }
  return context;
}

/**
 * Hook to get enabled plugins only
 */
export function useEnabledPlugins(): Plugin[] {
  const { plugins } = usePlugins();
  return plugins.filter((plugin) => plugin.state === 'enabled');
}

/**
 * Hook to get plugin extensions for a specific extension point
 */
export function usePluginExtensions(extensionPoint: string) {
  const { getPluginExtensions, plugins } = usePlugins();
  const [extensions, setExtensions] = useState<unknown[]>([]);

  useEffect(() => {
    getPluginExtensions(extensionPoint).then(setExtensions);
  }, [extensionPoint, plugins]);

  return extensions;
}
