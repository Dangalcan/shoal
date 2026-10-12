/**
 * PluginModalBridge
 *
 * Opens a plugin's registered modal when MAIN-PROCESS plugin code calls
 * `context.ui.openModal(modalId, props)` (IPC event `plugin-modal`). Plugin
 * UIs open modals through the sandbox SDK instead; this component only
 * bridges the main-process path, the way PluginNotifications does for
 * notifications. The modal itself renders in its own sandboxed iframe.
 */

import { useEffect } from 'react';
import { useApi } from '../../services/api-context';
import { usePluginModal } from './sandbox/usePluginModal';
import type { PluginModalData } from '../../types';

export function PluginModalBridge() {
  const api = useApi();
  const { openModal, modalNode } = usePluginModal();

  useEffect(() => {
    if (!api.onPluginModal) return;
    return api.onPluginModal((data: PluginModalData) => {
      openModal(data.pluginId, data.component, data.props);
    });
  }, [api, openModal]);

  return <>{modalNode}</>;
}
