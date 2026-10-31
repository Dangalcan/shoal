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
  useRef,
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
  // Set once the first list has arrived. Later refreshes (plugin state
  // events, enable/disable, reload) update the list in place: showing the
  // loading state again would swap the list for a spinner and remount every
  // card, and a click that straddles that remount is lost.
  const hasLoaded = useRef(false);

  // Reads the plugin list and stores the answer, or the failure, from the
  // promise callbacks, which also turn the loading state off. The caller
  // decides whether that state is on beforehand: the initial render starts
  // with it on, `refreshPlugins` turns it on only until the first list has
  // arrived. Callbacks rather than `await`, because the effect lint rule
  // takes an async function that writes state after `await` for a
  // synchronous write.
  const loadPlugins = () =>
    api.getPlugins().then(
      (result) => {
        if (result.success) {
          setPlugins(result.data);
          hasLoaded.current = true;
        } else {
          setError(result.error || 'Failed to load plugins');
        }
        setLoading(false);
      },
      (err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load plugins');
        setLoading(false);
      }
    );

  const refreshPlugins = async () => {
    if (!hasLoaded.current) setLoading(true);
    setError(null);
    await loadPlugins();
  };

  const actions = usePluginActions(plugins, refreshPlugins);

  // Load plugins on mount
  useEffect(() => {
    void loadPlugins();
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
