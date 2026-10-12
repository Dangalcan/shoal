import { Copy, Check, Loader2, Code, Save } from 'lucide-react';
import { BaseModal } from './BaseModal';
import { useApi } from '../../services/api-context';
import { useResourceModal } from '../../hooks/useResourceModal';
import { toast } from 'sonner';
import { useState } from 'react';

interface YamlModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusterName: string;
  resourceName: string;
  resourceType: string;
  namespace: string;
}

export function YamlModal({
  isOpen,
  onClose,
  clusterName,
  resourceName,
  resourceType,
  namespace,
}: YamlModalProps) {
  const api = useApi();
  const {
    content: yaml,
    loading,
    copied,
    error,
    contentRef,
    copyToClipboard,
  } = useResourceModal({
    isOpen,
    clusterName,
    resourceName,
    fetchFn: () =>
      api.getResourceYaml({
        contextName: clusterName,
        resourceType,
        resourceName,
        namespace,
      }),
    errorTitle: 'YAML Fetch Failed',
  });
  const [saveLoading, setSaveLoading] = useState(false);

  const handleSaveToDb = async () => {
    if (!yaml) return;
    setSaveLoading(true);
    try {
      const result = await api.saveManifest({
        name: resourceName,
        content: yaml,
        cluster_context: clusterName,
      });
      if (result.success) {
        toast.success(`Manifest "${resourceName}" saved to database`);
      } else {
        toast.error(`Failed to save manifest: ${result.error}`);
      }
    } catch (err: unknown) {
      toast.error(
        `Error saving manifest: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSaveLoading(false);
    }
  };

  const headerActions = (
    <div className="flex gap-2">
      <button
        onClick={handleSaveToDb}
        disabled={!yaml || saveLoading}
        className="modal-action-button"
        title="Save to Manifest Manager"
      >
        {saveLoading ? (
          <Loader2 size={14} className="spinner" />
        ) : (
          <Save size={14} />
        )}
        {saveLoading ? 'Saving...' : 'Save to DB'}
      </button>
      <button
        onClick={copyToClipboard}
        disabled={!yaml}
        className="modal-action-button"
        title="Copy YAML"
      >
        {copied ? (
          <Check size={14} className="modal-action-button-success" />
        ) : (
          <Copy size={14} />
        )}
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );

  const footerContent = (
    <>
      <p className="modal-footer-info modal-footer-info-accent">
        Context: {clusterName}
      </p>
      <button onClick={onClose} className="close-footer-button">
        Close
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Resource YAML"
      subtitle={`${namespace} / ${resourceName}`}
      icon={<Code size={20} />}
      headerActions={headerActions}
      footer={footerContent}
      className="yaml-modal"
      width="900px"
      data-testid="yaml-modal"
    >
      {loading ? (
        <div className="state-container">
          <Loader2 className="spinner" size={32} />
          <p>Fetching YAML for {resourceName}...</p>
        </div>
      ) : error ? (
        <div className="state-container">
          <p className="error-title">Error</p>
          <p className="error-message">{error}</p>
        </div>
      ) : (
        <pre ref={contentRef} className="content-text code-block">
          {yaml || 'No output available'}
        </pre>
      )}
    </BaseModal>
  );
}
