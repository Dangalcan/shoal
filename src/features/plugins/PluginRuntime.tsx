/**
 * Plugin Runtime
 * 
 * Dynamically loads plugin UI bundles into the renderer process.
 * Monitors enabled plugins and injects their renderer entry scripts.
 */

import { useEffect, useRef } from 'react';
import { usePlugins } from './PluginProvider';
import { toast } from 'sonner';

interface PluginScriptState {
  pluginId: string;
  scriptElement: HTMLScriptElement | null;
  styleElements: HTMLLinkElement[];
  loaded: boolean;
}

export function PluginRuntime() {
  const { plugins } = usePlugins();
  const loadedScripts = useRef<Map<string, PluginScriptState>>(new Map());

  // Handle Notifications & Modals
  useEffect(() => {
    const electron = window.electron;
    if (!electron) return;

    const cleanupNotification = electron.onPluginNotification((data: any) => {
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

    const cleanupModal = electron.onPluginModal((data: any) => {
      const { component, props, pluginId } = data;
      const plugin = plugins.find(p => p.manifest.id === pluginId);
      const name = plugin ? plugin.manifest.name : pluginId;
      
      console.log(`[PluginRuntime] Modal requested from ${name}:`, component, props);
      toast.info(`Modal requested by ${name}`, { 
        description: `Component: ${component}. (UI integration pending full renderer registry)`,
        duration: 5000 
      });
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
          console.log(`[PluginRuntime] Loading UI for ${plugin.manifest.id}`);
          
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
            script.type = 'module'; // Assume ES modules for modern plugins
            
            script.onload = () => {
              console.log(`[PluginRuntime] Successfully loaded UI for ${plugin.manifest.id}`);
              toast.success(`Loaded plugin UI: ${plugin.manifest.name}`);
            };
            
            script.onerror = (e) => {
              console.error(`[PluginRuntime] Failed to load UI for ${plugin.manifest.id}`, e);
              toast.error(`Failed to load plugin UI: ${plugin.manifest.name}`);
            };

            document.body.appendChild(script);
            
            loadedScripts.current.set(plugin.manifest.id, {
              pluginId: plugin.manifest.id,
              scriptElement: script,
              styleElements,
              loaded: true
            });
            
          } catch (err) {
            console.error(`[PluginRuntime] Error injecting script for ${plugin.manifest.id}`, err);
          }
        }
      }

      // 3. Unload disabled plugins
      // Identify plugins that are in our loaded map but no longer enabled or present
      const activeIds = new Set(enabledPlugins.map(p => p.manifest.id));
      
      for (const [id, state] of loadedScripts.current.entries()) {
        if (!activeIds.has(id)) {
          console.log(`[PluginRuntime] Unloading UI for ${id}`);
          
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
          
          loadedScripts.current.delete(id);
        }
      }
    };

    checkPlugins();

  }, [plugins]);

  return null; // Side-effect only component
}

