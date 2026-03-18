/**
 * Plugin Provider Context
 *
 * Provides plugin state and management functions to the React application.
 */

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import type { Plugin, PluginScaffoldOptions } from '../../../electron/types/plugin-types';
import { useApi } from '../../services/api-context';
import { toast } from 'sonner';

interface PluginContextType {
  plugins: Plugin[];
  loading: boolean;
  error: string | null;
  refreshPlugins: () => Promise<void>;
  enablePlugin: (pluginId: string) => Promise<void>;
  disablePlugin: (pluginId: string) => Promise<void>;
  getPluginExtensions: (extensionPoint?: string) => Promise<unknown[]>;
  executePluginAction: (pluginId: string, actionId: string, args?: unknown) => Promise<unknown>;
  activateLicense: (pluginId: string, key: string) => Promise<void>;
  startTrial: (pluginId: string) => Promise<void>;
  deactivateLicense: (pluginId: string) => Promise<void>;
  installPlugin: (pluginId: string) => Promise<void>;
  getSettings: (pluginId: string) => Promise<Record<string, unknown>>;
  saveSettings: (pluginId: string, settings: Record<string, unknown>) => Promise<void>;
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

  const handleActionResult = async (
    action: () => Promise<{ success: boolean; data?: unknown; error?: string }>,
    defaultError: string,
    refreshOnSuccess = true
  ) => {
    try {
      const result = await action();
      if (result.success) {
        if (refreshOnSuccess) {
          await refreshPlugins();
        }
        return result.data;
      }
      throw new Error(result.error || defaultError);
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : defaultError);
    }
  };

  const enablePlugin = async (pluginId: string): Promise<void> => {
    const result = await api.enablePlugin(pluginId);
    if (!result.success) throw new Error(result.error || 'Failed to enable plugin');
    const autoDeps: string[] = Array.isArray(result.data) ? result.data : [];
    const depNames = autoDeps.map(
      (id) => plugins.find((p) => p.manifest.id === id)?.manifest.name ?? id
    );
    await refreshPlugins();
    if (depNames.length > 0) {
      toast.info(`Also enabled: ${depNames.join(', ')}`, {
        description: 'These plugins are required dependencies.',
      });
    }
  };

  const disablePlugin = async (pluginId: string): Promise<void> => {
    const result = await api.disablePlugin(pluginId);
    if (!result.success) throw new Error(result.error || 'Failed to disable plugin');
    const cascaded = result.data ?? [];
    const cascadeNames = cascaded.map(
      id => plugins.find(p => p.manifest.id === id)?.manifest.name ?? id
    );
    await refreshPlugins();
    if (cascadeNames.length > 0) {
      toast.warning(`Also disabled: ${cascadeNames.join(', ')}`, {
        description: 'These plugins depended on the one you disabled.',
      });
    }
  };
  const executePluginAction = (pluginId: string, actionId: string, args?: unknown) => handleActionResult(() => api.executePluginAction(pluginId, actionId, args), 'Failed to execute plugin action', false);
  const activateLicense = (pluginId: string, key: string) => handleActionResult(() => api.activatePluginLicense(pluginId, key), 'Failed to activate license');
  const startTrial = (pluginId: string) => handleActionResult(() => api.startPluginTrial(pluginId), 'Failed to start trial');
  const deactivateLicense = (pluginId: string) => handleActionResult(() => api.deactivatePluginLicense(pluginId), 'Failed to deactivate license');
  const installPlugin = (pluginId: string) => handleActionResult(() => api.installPlugin(pluginId), 'Failed to install plugin');
  const saveSettings = (pluginId: string, settings: Record<string, unknown>) => handleActionResult(() => api.setPluginSettings(pluginId, settings), 'Failed to save settings', false);
  const generatePlugin = (options: PluginScaffoldOptions) => handleActionResult(() => api.generatePlugin(options), 'Failed to generate plugin');
  const reloadPlugin = (pluginId: string) => handleActionResult(() => api.reloadPlugin(pluginId), 'Failed to reload plugin');
  const uninstallPlugin = (pluginId: string) => handleActionResult(() => api.uninstallPlugin(pluginId), 'Failed to uninstall plugin');

  const getPluginExtensions = async (extensionPoint?: string) => {
    try {
      const result = await api.getPluginExtensions(extensionPoint);
      if (result.success && result.data) {
        return result.data;
      }
      return [];
    } catch (err: unknown) {
      toast.error('Failed to load plugin extensions', { description: err instanceof Error ? err.message : undefined });
      return [];
    }
  };

  const getSettings = async (pluginId: string) => {
    try {
      const result = await api.getPluginSettings(pluginId);
      if (result.success && result.data) {
        return result.data;
      }
      return {};
    } catch (err: unknown) {
      toast.error('Failed to load plugin settings', { description: err instanceof Error ? err.message : undefined });
      return {};
    }
  };

  const checkForUpdates = async () => {
    try {
      await api.checkForPluginUpdates();
      await refreshPlugins();
    } catch (err: unknown) {
      toast.error('Failed to check for plugin updates', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const importLocalPlugin = async () => {
    try {
      const result = await api.importLocalPlugin();
      // result.data may be null if cancelled, string (pluginId) if success
      if (result.success && result.data) {
        await refreshPlugins();
      } else if (!result.success) {
        throw new Error(result.error || 'Failed to import plugin');
      }
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : 'Failed to import plugin');
    }
  };

  // Load plugins on mount
  useEffect(() => {
    refreshPlugins();
    checkForUpdates();
  }, []);

  const value: PluginContextType = {
    plugins,
    loading,
    error,
    refreshPlugins,
    enablePlugin,
    disablePlugin,
    getPluginExtensions,
    executePluginAction,
    activateLicense: activateLicense as unknown as PluginContextType['activateLicense'],
    startTrial: startTrial as unknown as PluginContextType['startTrial'],
    deactivateLicense: deactivateLicense as unknown as PluginContextType['deactivateLicense'],
    installPlugin: installPlugin as unknown as PluginContextType['installPlugin'],
    getSettings,
    saveSettings: saveSettings as unknown as PluginContextType['saveSettings'],
    checkForUpdates,
    generatePlugin: generatePlugin as unknown as PluginContextType['generatePlugin'],
    reloadPlugin: reloadPlugin as unknown as PluginContextType['reloadPlugin'],
    uninstallPlugin: uninstallPlugin as unknown as PluginContextType['uninstallPlugin'],
    importLocalPlugin,
  };

  return <PluginContext.Provider value={value}>{children}</PluginContext.Provider>;
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
  return plugins.filter(plugin => plugin.state === 'enabled');
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
