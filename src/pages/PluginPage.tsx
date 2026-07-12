/**
 * Plugin Page Host
 *
 * Renders a plugin's dedicated page inside a sandboxed iframe (see
 * features/plugins/sandbox/PluginFrame). The plugin UI runs with an opaque
 * origin and no access to window.electron; all capabilities are mediated by
 * the permission-gated bridge.
 */

import { useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlugins } from '../features/plugins/PluginProvider';
import { PluginFrame } from '../features/plugins/sandbox/PluginFrame';
import { PluginModalHost } from '../features/plugins/sandbox/PluginModalHost';
import { buildPluginFrameUrls } from '../features/plugins/sandbox/frame-props';
import { AlertTriangle, Home, Loader2 } from 'lucide-react';
import { Button } from '../components/ui';

interface OpenModal {
  modalId: string;
  props: unknown;
}

export function PluginPage() {
  const { pluginId } = useParams<{ pluginId: string }>();
  const navigate = useNavigate();
  const { plugins, loading } = usePlugins();
  const [title, setTitle] = useState<string | null>(null);
  const [modal, setModal] = useState<OpenModal | null>(null);

  // Stable so the page frame doesn't re-init on every render.
  const handleOpenModal = useCallback((modalId: string, props: unknown) => {
    setModal({ modalId, props });
  }, []);
  const handleCloseModal = useCallback(() => setModal(null), []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="spinner" size={40} />
      </div>
    );
  }

  const plugin = plugins.find((p) => p.manifest.id === pluginId);

  if (!plugin || plugin.state !== 'enabled') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <AlertTriangle size={48} className="text-warning" />
        <h2>Plugin Not Active</h2>
        <p>This plugin is either not installed or disabled.</p>
        <Button onClick={() => navigate('/plugins')}>Manage Plugins</Button>
      </div>
    );
  }

  if (!plugin.rendererEntry) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <AlertTriangle size={48} className="text-error" />
        <h2>No UI to Show</h2>
        <p>
          The plugin <strong>{plugin.manifest.name}</strong> does not provide a
          page UI.
        </p>
        <Button onClick={() => navigate('/')} variant="secondary">
          <Home size={16} className="mr-2" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  const urls = buildPluginFrameUrls(plugin);
  if (!urls) return null;

  return (
    <div
      key={pluginId}
      className="plugin-page-container h-full overflow-hidden flex flex-col"
    >
      {title && <div className="plugin-page-title">{title}</div>}
      <PluginFrame
        pluginId={plugin.manifest.id}
        hostDocumentUrl={urls.hostDocumentUrl}
        entryUrl={urls.entryUrl}
        styleUrls={urls.styleUrls}
        permissions={urls.permissions}
        sizing="fill"
        onTitle={setTitle}
        onOpenModal={handleOpenModal}
        className="flex-1"
      />
      {modal && (
        <PluginModalHost
          pluginId={plugin.manifest.id}
          urls={urls}
          modalId={modal.modalId}
          props={modal.props}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
