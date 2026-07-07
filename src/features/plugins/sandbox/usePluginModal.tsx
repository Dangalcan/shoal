/**
 * usePluginModal
 *
 * Shared helper for any host surface that lets a plugin open a modal (plugin
 * pages, dashboard widgets, resource-table actions). Owns the open/close state
 * and renders the sandboxed modal overlay. The modal UI runs in its own iframe;
 * no plugin code runs in the host realm.
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { usePlugins } from '../PluginProvider';
import { PluginModalHost } from './PluginModalHost';
import { buildPluginFrameUrls } from './frame-props';

interface OpenModal {
  pluginId: string;
  modalId: string;
  props: unknown;
}

export interface PluginModalController {
  /** Open a plugin's registered modal by id, passing structured-clone props. */
  openModal: (pluginId: string, modalId: string, props?: unknown) => void;
  /** Close the current modal. */
  closeModal: () => void;
  /** The overlay element to render (or null when nothing is open). */
  modalNode: ReactNode;
}

export function usePluginModal(): PluginModalController {
  const { plugins } = usePlugins();
  const [open, setOpen] = useState<OpenModal | null>(null);

  const openModal = useCallback(
    (pluginId: string, modalId: string, props?: unknown) => {
      setOpen({ pluginId, modalId, props });
    },
    []
  );
  const closeModal = useCallback(() => setOpen(null), []);

  const modalNode = useMemo<ReactNode>(() => {
    if (!open) return null;
    const plugin = plugins.find((p) => p.manifest.id === open.pluginId);
    if (!plugin) return null;
    const urls = buildPluginFrameUrls(plugin);
    if (!urls) return null;
    return (
      <PluginModalHost
        pluginId={plugin.manifest.id}
        urls={urls}
        modalId={open.modalId}
        props={open.props}
        onClose={closeModal}
      />
    );
  }, [open, plugins, closeModal]);

  return { openModal, closeModal, modalNode };
}
