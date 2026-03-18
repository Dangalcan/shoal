/**
 * Plugin Runtime
 * 
 * Dynamically loads plugin UI bundles into the renderer process.
 * Monitors enabled plugins and injects their renderer entry scripts.
 */

import { useEffect, useRef, useState } from 'react';
import { usePlugins } from './PluginProvider';
import { toast } from 'sonner';
import { pluginUIRegistry, pluginScriptTracker } from '../../services/plugin-ui-registry';
import type { PluginNotificationData, PluginModalData } from '../../types';

interface PluginScriptState {
  pluginId: string;
  scriptElement: HTMLScriptElement | null;
  styleElements: HTMLLinkElement[];
  loaded: boolean;
}

interface ActiveModal {
  id: string;
  props: Record<string, unknown>;
  pluginId: string;
}

export function PluginRuntime() {
  const { plugins } = usePlugins();
  const loadedScripts = useRef<Map<string, PluginScriptState>>(new Map());
  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null);

  // Handle Notifications & Modals
  useEffect(() => {
    const electron = window.electron;
    if (!electron) return;

    const cleanupNotification = electron.onPluginNotification((data: PluginNotificationData) => {
      const { message, type, pluginId } = data;
      const plugin = plugins.find(p => p.manifest.id === pluginId);
      const name = plugin ? plugin.manifest.name : pluginId;

      switch (type) {
        case 'success': toast.success(message, { description: `From: ${name}` }); break;
        case 'error': toast.error(message, { description: `From: ${name}` }); break;
        case 'warning': toast.warning(message, { description: `From: ${name}` }); break;
        default: toast.info(message, { description: `From: ${name}` });
      }
    });

    const cleanupModal = electron.onPluginModal((data: PluginModalData) => {
      const { component, props, pluginId } = data;
      const plugin = plugins.find(p => p.manifest.id === pluginId);
      const name = plugin ? plugin.manifest.name : pluginId;

      const registration = pluginUIRegistry.getModal(component);
      if (!registration) {
        toast.error(`Plugin modal not found: "${component}"`, { description: `From: ${name}` });
        return;
      }

      setActiveModal({ id: component, props: props ?? {}, pluginId });
    });

    return () => {
      cleanupNotification();
      cleanupModal();
    };
  }, [plugins]);

  // Dynamic Plugin Loading
  useEffect(() => {
    // 1. Identify enabled plugins with a renderer entry
    const checkPlugins = async () => {
      const enabledPlugins = plugins.filter(
        p => p.state === 'enabled' && p.rendererEntry
      );

      // 2. Load new plugins
      for (const plugin of enabledPlugins) {
        if (!loadedScripts.current.has(plugin.manifest.id)) {
          try {
            const styleElements: HTMLLinkElement[] = [];

            // 2.1 Load Styles
            if (plugin.rendererStyles && plugin.rendererStyles.length > 0) {
              for (const stylePath of plugin.rendererStyles) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = `plugin-file:///${stylePath}`;
                document.head.appendChild(link);
                styleElements.push(link);
              }
            }

            // 2.2 Load Script
            const script = document.createElement('script');
            // Use custom protocol with triple slash for absolute paths
            script.src = `plugin-file:///${plugin.rendererEntry}`;
            script.async = true;

            pluginScriptTracker.setStatus(plugin.manifest.id, 'loading');

            script.onload = () => {
              pluginScriptTracker.setStatus(plugin.manifest.id, 'loaded');
            };

            script.onerror = () => {
              pluginScriptTracker.setStatus(plugin.manifest.id, 'error');
              toast.error(`Failed to load plugin UI: ${plugin.manifest.name}`);
            };

            document.body.appendChild(script);

            loadedScripts.current.set(plugin.manifest.id, {
              pluginId: plugin.manifest.id,
              scriptElement: script,
              styleElements,
              loaded: false,
            });

          } catch (err) {
            pluginScriptTracker.setStatus(plugin.manifest.id, 'error');
          }
        }
      }

      // 3. Unload disabled plugins
      // Identify plugins that are in our loaded map but no longer enabled or present
      const activeIds = new Set(enabledPlugins.map(p => p.manifest.id));
      
      for (const [id, state] of loadedScripts.current.entries()) {
        if (!activeIds.has(id)) {

          // Remove script
          if (state.scriptElement && state.scriptElement.parentNode) {
            state.scriptElement.parentNode.removeChild(state.scriptElement);
          }

          // Remove styles
          if (state.styleElements) {
            for (const link of state.styleElements) {
              if (link.parentNode) {
                link.parentNode.removeChild(link);
              }
            }
          }

          // Clean up script tracker and UI registrations
          pluginScriptTracker.clear(id);
          pluginUIRegistry.unregisterPage(id);
          pluginUIRegistry.unregisterWidgetsByPlugin(id);
          pluginUIRegistry.unregisterResourceAction(id);
          pluginUIRegistry.unregisterModal(id);

          loadedScripts.current.delete(id);
        }
      }
    };

    checkPlugins();

  }, [plugins]);

  if (!activeModal) return null;

  const registration = pluginUIRegistry.getModal(activeModal.id);
  if (!registration) return null;

  const ModalComponent = registration.component;
  return <ModalComponent onClose={() => setActiveModal(null)} {...activeModal.props} />;
}

