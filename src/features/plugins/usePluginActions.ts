/**
 * usePluginActions — API action functions extracted from PluginProvider
 *
 * Encapsulates all plugin mutation logic so PluginProvider only manages
 * state and context wiring.
 */

import { useApi } from '../../services/api-context';
import { toast } from 'sonner';
import type {
  Plugin,
  PluginScaffoldOptions,
} from '../../../electron/types/plugin-types';

export function usePluginActions(
  plugins: Plugin[],
  refreshPlugins: () => Promise<void>
) {
  const api = useApi();

  const handleActionResult = async (
    action: () => Promise<{ success: boolean; data?: unknown; error?: string }>,
    defaultError: string,
    refreshOnSuccess = true
  ): Promise<void> => {
    try {
      const result = await action();
      if (result.success) {
        if (refreshOnSuccess) await refreshPlugins();
      } else {
        throw new Error(result.error || defaultError);
      }
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : defaultError);
    }
  };

  const enablePlugin = async (pluginId: string): Promise<void> => {
    const result = await api.enablePlugin(pluginId);
    if (!result.success)
      throw new Error(result.error || 'Failed to enable plugin');
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
    if (!result.success)
      throw new Error(result.error || 'Failed to disable plugin');
    const cascaded = result.data ?? [];
    const cascadeNames = (cascaded as string[]).map(
      (id) => plugins.find((p) => p.manifest.id === id)?.manifest.name ?? id
    );
    await refreshPlugins();
    if (cascadeNames.length > 0) {
      toast.warning(`Also disabled: ${cascadeNames.join(', ')}`, {
        description: 'These plugins depended on the one you disabled.',
      });
    }
  };

  const executePluginAction = (
    pluginId: string,
    actionId: string,
    args?: unknown
  ) =>
    handleActionResult(
      () => api.executePluginAction(pluginId, actionId, args),
      'Failed to execute plugin action',
      false
    );

  const activateLicense = (pluginId: string, key: string) =>
    handleActionResult(
      () => api.activatePluginLicense(pluginId, key),
      'Failed to activate license'
    );

  const startTrial = (pluginId: string) =>
    handleActionResult(
      () => api.startPluginTrial(pluginId),
      'Failed to start trial'
    );

  const deactivateLicense = (pluginId: string) =>
    handleActionResult(
      () => api.deactivatePluginLicense(pluginId),
      'Failed to deactivate license'
    );

  const installPlugin = (pluginId: string) =>
    handleActionResult(
      () => api.installPlugin(pluginId),
      'Failed to install plugin'
    );

  const saveSettings = (pluginId: string, settings: Record<string, unknown>) =>
    handleActionResult(
      () => api.setPluginSettings(pluginId, settings),
      'Failed to save settings',
      false
    );

  const generatePlugin = (options: PluginScaffoldOptions) =>
    handleActionResult(
      () => api.generatePlugin(options),
      'Failed to generate plugin'
    );

  const reloadPlugin = (pluginId: string) =>
    handleActionResult(
      () => api.reloadPlugin(pluginId),
      'Failed to reload plugin'
    );

  const uninstallPlugin = (pluginId: string) =>
    handleActionResult(
      () => api.uninstallPlugin(pluginId),
      'Failed to uninstall plugin'
    );

  const getPluginExtensions = async (
    extensionPoint?: string
  ): Promise<unknown[]> => {
    try {
      const result = await api.getPluginExtensions(extensionPoint);
      if (result.success && result.data) return result.data;
      return [];
    } catch (err: unknown) {
      toast.error('Failed to load plugin extensions', {
        description: err instanceof Error ? err.message : undefined,
      });
      return [];
    }
  };

  const getSettings = async (
    pluginId: string
  ): Promise<Record<string, unknown>> => {
    try {
      const result = await api.getPluginSettings(pluginId);
      if (result.success && result.data) return result.data;
      return {};
    } catch (err: unknown) {
      toast.error('Failed to load plugin settings', {
        description: err instanceof Error ? err.message : undefined,
      });
      return {};
    }
  };

  const checkForUpdates = async (): Promise<void> => {
    try {
      await api.checkForPluginUpdates();
      await refreshPlugins();
    } catch (err: unknown) {
      toast.error('Failed to check for plugin updates', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const importLocalPlugin = async (): Promise<void> => {
    try {
      const result = await api.importLocalPlugin();
      if (result.success && result.data) {
        await refreshPlugins();
      } else if (!result.success) {
        throw new Error(result.error || 'Failed to import plugin');
      }
    } catch (err: unknown) {
      throw new Error(
        err instanceof Error ? err.message : 'Failed to import plugin'
      );
    }
  };

  return {
    enablePlugin,
    disablePlugin,
    executePluginAction,
    activateLicense,
    startTrial,
    deactivateLicense,
    installPlugin,
    saveSettings,
    generatePlugin,
    reloadPlugin,
    uninstallPlugin,
    getPluginExtensions,
    getSettings,
    checkForUpdates,
    importLocalPlugin,
  };
}
