/**
 * Plugin Provider Context
 * 
 * Provides plugin state and management functions to the React application.
 */

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import type { Plugin } from '../../../electron/types/plugin-types';
import { useApi } from '../../services/api-context';

interface PluginContextType {
  plugins: Plugin[];
  loading: boolean;
  error: string | null;
  refreshPlugins: () => Promise<void>;
  enablePlugin: (pluginId: string) => Promise<void>;
  disablePlugin: (pluginId: string) => Promise<void>;
  getPluginExtensions: (extensionPoint?: string) => Promise<any[]>;
  executePluginAction: (pluginId: string, actionId: string, args?: any) => Promise<any>;
  activateLicense: (pluginId: string, key: string) => Promise<void>;
  startTrial: (pluginId: string) => Promise<void>;
  deactivateLicense: (pluginId: string) => Promise<void>;
  installPlugin: (pluginId: string) => Promise<void>;
  getSettings: (pluginId: string) => Promise<Record<string, any>>;
  saveSettings: (pluginId: string, settings: Record<string, any>) => Promise<void>;
  checkForUpdates: () => Promise<void>;
  generatePlugin: (options: any) => Promise<void>;
  reloadPlugin: (pluginId: string) => Promise<void>;
  uninstallPlugin: (pluginId: string) => Promise<void>;
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
    } catch (err: any) {
      setError(err.message || 'Failed to load plugins');
    } finally {
      setLoading(false);
    }
  };

  const enablePlugin = async (pluginId: string) => {
    try {
      const result = await api.enablePlugin(pluginId);
      if (result.success) {
        await refreshPlugins();
      } else {
        throw new Error(result.error || 'Failed to enable plugin');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to enable plugin');
    }
  };

  const disablePlugin = async (pluginId: string) => {
    try {
      const result = await api.disablePlugin(pluginId);
      if (result.success) {
        await refreshPlugins();
      } else {
        throw new Error(result.error || 'Failed to disable plugin');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to disable plugin');
    }
  };

  const getPluginExtensions = async (extensionPoint?: string) => {
    try {
      const result = await api.getPluginExtensions(extensionPoint);
      if (result.success && result.data) {
        return result.data;
      }
      return [];
    } catch (err) {
      console.error('Failed to get plugin extensions:', err);
      return [];
    }
  };

  const executePluginAction = async (pluginId: string, actionId: string, args?: any) => {
    try {
      const result = await api.executePluginAction(pluginId, actionId, args);
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to execute plugin action');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to execute plugin action');
    }
  };

  const activateLicense = async (pluginId: string, key: string) => {
    try {
      const result = await api.activatePluginLicense(pluginId, key);
      if (result.success) {
        await refreshPlugins();
      } else {
        throw new Error(result.error || 'Failed to activate license');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to activate license');
    }
  };

  const startTrial = async (pluginId: string) => {
    try {
      const result = await api.startPluginTrial(pluginId);
      if (result.success) {
        await refreshPlugins();
      } else {
        throw new Error(result.error || 'Failed to start trial');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to start trial');
    }
  };

  const deactivateLicense = async (pluginId: string) => {
    try {
      const result = await api.deactivatePluginLicense(pluginId);
      if (result.success) {
        await refreshPlugins();
      } else {
        throw new Error(result.error || 'Failed to deactivate license');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to deactivate license');
    }
  };

  const installPlugin = async (pluginId: string) => {
    try {
      const result = await api.installPlugin(pluginId);
      if (result.success) {
        await refreshPlugins();
      } else {
        throw new Error(result.error || 'Failed to install plugin');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to install plugin');
    }
  };

  const getSettings = async (pluginId: string) => {
    try {
      const result = await api.getPluginSettings(pluginId);
      if (result.success && result.data) {
        return result.data;
      }
      return {};
    } catch (err) {
      console.error('Failed to get plugin settings:', err);
      return {};
    }
  };

  const saveSettings = async (pluginId: string, settings: Record<string, any>) => {
    try {
      const result = await api.setPluginSettings(pluginId, settings);
      if (result.success) {
        // Maybe refresh plugins if settings affect state?
      } else {
        throw new Error(result.error || 'Failed to save settings');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to save settings');
    }
  };

  const checkForUpdates = async () => {
    try {
      await api.checkForPluginUpdates();
      await refreshPlugins();
    } catch (err) {
      console.error('Failed to check for updates:', err);
    }
  };

  const generatePlugin = async (options: any) => {
    try {
      const result = await api.generatePlugin(options);
      if (result.success) {
        await refreshPlugins();
      } else {
        throw new Error(result.error || 'Failed to generate plugin');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to generate plugin');
    }
  };

  const reloadPlugin = async (pluginId: string) => {
    try {
      const result = await api.reloadPlugin(pluginId);
      if (result.success) {
        await refreshPlugins();
      } else {
        throw new Error(result.error || 'Failed to reload plugin');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to reload plugin');
    }
  };

  const uninstallPlugin = async (pluginId: string) => {
    try {
      const result = await api.uninstallPlugin(pluginId);
      if (result.success) {
        await refreshPlugins();
      } else {
        throw new Error(result.error || 'Failed to uninstall plugin');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to uninstall plugin');
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
    activateLicense,
    startTrial,
    deactivateLicense,
    installPlugin,
    getSettings,
    saveSettings,
    checkForUpdates,
    generatePlugin,
    reloadPlugin,
    uninstallPlugin,
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
  const { getPluginExtensions } = usePlugins();
  const [extensions, setExtensions] = useState<any[]>([]);

  useEffect(() => {
    getPluginExtensions(extensionPoint).then(setExtensions);
  }, [extensionPoint]);

  return extensions;
}
