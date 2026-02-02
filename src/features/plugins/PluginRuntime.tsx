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
  loaded: boolean;
}

export function PluginRuntime() {
  const { plugins } = usePlugins();
  const loadedScripts = useRef<Map<string, PluginScriptState>>(new Map());

  // Handle Notifications
  useEffect(() => {
    if (window.electron?.onPluginNotification) {
      const cleanup = window.electron.onPluginNotification((data: any) => {
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
      return cleanup;
    }
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
          console.log(`[PluginRuntime] Loading UI bundle for ${plugin.manifest.id}`);
          
          try {
            const script = document.createElement('script');
            // Use file protocol for local files. 
            // In production Electron, this might need a custom protocol handler or CSP adjustments.
            script.src = `file://${plugin.rendererEntry}`; 
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
          
          if (state.scriptElement && state.scriptElement.parentNode) {
            state.scriptElement.parentNode.removeChild(state.scriptElement);
          }
          
          // Note: Removing the script tag DOES NOT remove the code from memory if it executed.
          // Real dynamic unloading requires a more sophisticated module system (like SystemJS)
          // or a completely different architecture (iframe/webview).
          // For now, we accept that global side effects might persist until reload.
          
          loadedScripts.current.delete(id);
        }
      }
    };

    checkPlugins();

  }, [plugins]);

  return null; // Side-effect only component
}

