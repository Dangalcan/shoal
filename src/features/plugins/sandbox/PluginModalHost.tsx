/**
 * PluginModalHost
 *
 * Renders a plugin-requested modal in a host overlay. The modal UI itself runs
 * in its OWN sandboxed iframe (a PluginFrame with a `modal` view) — no plugin
 * code executes in the host realm. The host only provides the backdrop and
 * dismissal; the plugin owns the modal content.
 */

import { createPortal } from 'react-dom';
import { PluginFrame } from './PluginFrame';
import type { PluginFrameUrls } from './frame-props';

interface PluginModalHostProps {
  pluginId: string;
  urls: PluginFrameUrls;
  modalId: string;
  /** Structured-clone-safe data passed from the plugin's showModal call. */
  props: unknown;
  onClose: () => void;
}

export function PluginModalHost({
  pluginId,
  urls,
  modalId,
  props,
  onClose,
}: PluginModalHostProps) {
  return createPortal(
    <div
      className="plugin-modal-overlay"
      role="presentation"
      onClick={(e) => {
        // Backdrop click closes; clicks inside the dialog do not.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="plugin-modal-dialog" role="dialog" aria-modal="true">
        <PluginFrame
          pluginId={pluginId}
          hostDocumentUrl={urls.hostDocumentUrl}
          entryUrl={urls.entryUrl}
          styleUrls={urls.styleUrls}
          permissions={urls.permissions}
          view={{ kind: 'modal', modalId }}
          viewProps={props}
          onCloseModal={onClose}
        />
      </div>
    </div>,
    document.body
  );
}
