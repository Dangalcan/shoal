/**
 * PluginFrame
 *
 * Hosts a single plugin's UI inside a sandboxed <iframe>. The iframe runs with
 * an opaque origin (`sandbox="allow-scripts"` — no allow-same-origin), so it
 * cannot touch the host DOM, cookies, or `window.electron`. All capabilities
 * flow through a MessageChannel governed by PluginHostBridge and the plugin's
 * declared permissions.
 *
 * Handshake:
 *   1. iframe loads the shipped host document (bootstrap.js sets up the SDK).
 *   2. on load, host creates a MessageChannel, keeps port1 (bridge), and
 *      transfers port2 into the iframe via postMessage(INIT, [port2]).
 *   3. bootstrap adopts the port, builds window.k8sPlugin, loads the plugin
 *      entry, and posts a 'ready' UI signal.
 */

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useApi } from '../../../services/api-context';
import { PluginHostBridge, type PortLike } from './host-bridge';
import { createElectronInvoker } from './electron-invoker';
import type { PluginPermission } from './protocol';

/** postMessage tag used to hand the SDK port to the iframe. */
export const PLUGIN_PORT_INIT = 'k8s-plugin-port-init';

/**
 * Snapshot the host document's stylesheets so the sandboxed iframe (which is a
 * separate document with none of the app's CSS) can reproduce the app's look.
 * In dev, Vite injects <style> tags (copied by text); in prod, hashed <link>
 * stylesheets (copied by href). The plugin's own styles are added separately.
 */
function collectHostStyles(): { texts: string[]; hrefs: string[] } {
  const texts: string[] = [];
  const hrefs: string[] = [];
  document.querySelectorAll('style').forEach((s) => {
    if (s.textContent) texts.push(s.textContent);
  });
  document
    .querySelectorAll('link[rel="stylesheet"]')
    .forEach((l) => {
      const href = (l as HTMLLinkElement).href;
      if (href) hrefs.push(href);
    });
  return { texts, hrefs };
}

interface PluginFrameProps {
  pluginId: string;
  /** Absolute plugin-file:// URL of the shipped iframe host document. */
  hostDocumentUrl: string;
  /** plugin-file:// URL of the plugin's renderer entry bundle. */
  entryUrl: string;
  /** plugin-file:// URLs of the plugin's stylesheets. */
  styleUrls?: string[];
  permissions: PluginPermission[];
  /** Notified when the plugin sets a page title. */
  onTitle?: (title: string) => void;
  className?: string;
}

export function PluginFrame({
  pluginId,
  hostDocumentUrl,
  entryUrl,
  styleUrls = [],
  permissions,
  onTitle,
  className,
}: PluginFrameProps) {
  const api = useApi();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const bridgeRef = useRef<PluginHostBridge | null>(null);
  const [height, setHeight] = useState<number>(0);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let disposed = false;

    const handleLoad = () => {
      if (disposed || !iframe.contentWindow) return;

      const channel = new MessageChannel();
      // Real MessagePort satisfies PortLike structurally; the interface uses a
      // minimal { data } event shape so it can be faked in unit tests.
      const bridge = new PluginHostBridge(channel.port1 as unknown as PortLike, {
        pluginId,
        permissions: new Set(permissions),
        invoke: createElectronInvoker(api),
        onResize: (h) => setHeight(h),
        onTitle: (t) => onTitle?.(t),
        onNotification: (message, type) => {
          const description = `From: ${pluginId}`;
          if (type === 'success') toast.success(message, { description });
          else if (type === 'error') toast.error(message, { description });
          else if (type === 'warning') toast.warning(message, { description });
          else toast.info(message, { description });
        },
      });
      bridge.start();
      bridgeRef.current = bridge;

      // Hand the plugin its port plus the URLs + host styles the bootstrap needs.
      const hostStyles = collectHostStyles();
      const theme = document.documentElement.getAttribute('data-theme');
      iframe.contentWindow.postMessage(
        {
          type: PLUGIN_PORT_INIT,
          pluginId,
          entryUrl,
          styleUrls,
          hostStyleTexts: hostStyles.texts,
          hostStyleHrefs: hostStyles.hrefs,
          theme,
        },
        '*',
        [channel.port2]
      );
    };

    iframe.addEventListener('load', handleLoad);
    return () => {
      disposed = true;
      iframe.removeEventListener('load', handleLoad);
      bridgeRef.current?.dispose();
      bridgeRef.current = null;
    };
  }, [pluginId, entryUrl, api, onTitle, permissions, styleUrls]);

  return (
    <iframe
      ref={iframeRef}
      title={`plugin-${pluginId}`}
      src={hostDocumentUrl}
      sandbox="allow-scripts"
      className={className}
      style={{
        width: '100%',
        height: height ? `${height}px` : '100%',
        border: 'none',
        display: 'block',
      }}
    />
  );
}
