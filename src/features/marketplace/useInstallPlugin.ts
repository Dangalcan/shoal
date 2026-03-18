import { useState } from 'react';
import { toast } from 'sonner';
import { usePlugins } from '../plugins/PluginProvider';

export function useInstallPlugin(pluginId: string, pluginName: string) {
  const { plugins, installPlugin } = usePlugins();
  const [installing, setInstalling] = useState(false);

  const installedPlugin = plugins.find((p) => p.manifest.id === pluginId);
  const isInstalled = !!installedPlugin;
  const hasUpdate = installedPlugin?.hasUpdate ?? false;

  const handleInstall = async () => {
    if (isInstalled || installing) return;
    setInstalling(true);
    const toastId = toast.loading(`Installing ${pluginName}...`);
    try {
      await installPlugin(pluginId);
      toast.success(`${pluginName} installed successfully!`, { id: toastId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Installation failed';
      toast.error(msg, { id: toastId });
    } finally {
      setInstalling(false);
    }
  };

  return {
    isInstalled,
    hasUpdate,
    installedPlugin,
    installing,
    handleInstall,
  };
}
