/**
 * Plugin Notifications
 *
 * Surfaces notifications emitted by MAIN-PROCESS plugin code (index.js, via the
 * plugin event bus) as toasts. Plugin UI notifications now flow through the
 * sandbox bridge instead; this component only bridges main-process events.
 *
 * This replaces the former PluginRuntime, which injected each plugin's
 * renderer.js into the host realm with full window.electron access. Plugin UIs
 * now run exclusively inside sandboxed iframes (PluginFrame), so no plugin code
 * executes in the host realm anymore.
 */

import { useEffect } from 'react';
import { toast } from 'sonner';
import { usePlugins } from './PluginProvider';
import type { PluginNotificationData } from '../../types';

export function PluginNotifications() {
  const { plugins } = usePlugins();

  useEffect(() => {
    const electron = window.electron;
    if (!electron) return;

    return electron.onPluginNotification((data: PluginNotificationData) => {
      const { message, type, pluginId } = data;
      const plugin = plugins.find((p) => p.manifest.id === pluginId);
      const description = `From: ${plugin ? plugin.manifest.name : pluginId}`;

      switch (type) {
        case 'success':
          toast.success(message, { description });
          break;
        case 'error':
          toast.error(message, { description });
          break;
        case 'warning':
          toast.warning(message, { description });
          break;
        default:
          toast.info(message, { description });
      }
    });
  }, [plugins]);

  return null;
}
