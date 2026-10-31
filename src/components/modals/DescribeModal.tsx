import { Copy, Check, Loader2, FileText } from 'lucide-react';
import { BaseModal } from './BaseModal';
import { useApi } from '../../services/api-context';
import { useResourceModal } from '../../hooks/useResourceModal';

interface DescribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusterName: string;
  resourceName: string;
  resourceType: string;
  namespace: string;
}

export function DescribeModal(props: DescribeModalProps) {
  // The dialog exists only while the modal is open, so every opening
  // fetches afresh (the resource may have changed since the last look).
  if (!props.isOpen) return null;
  return <DescribeDialog {...props} />;
}

function DescribeDialog({
  onClose,
  clusterName,
  resourceName,
  resourceType,
  namespace,
}: DescribeModalProps) {
  const api = useApi();
  const {
    content: output,
    loading,
    copied,
    error,
    contentRef,
    copyToClipboard,
  } = useResourceModal({
    clusterName,
    resourceName,
    fetchFn: () =>
      api.describeResource({
        contextName: clusterName,
        resourceType,
        resourceName,
        namespace,
      }),
    errorTitle: 'Describe Failed',
  });

  const headerActions = (
    <button
      onClick={copyToClipboard}
      disabled={!output}
      className="modal-action-button"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check size={14} className="modal-action-button-success" />
      ) : (
        <Copy size={14} />
      )}
      {copied ? 'Copied!' : 'Copy'}
    </button>
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
      isOpen
      onClose={onClose}
      title={`Describe ${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}`}
      subtitle={`${namespace} / ${resourceName}`}
      icon={<FileText size={20} />}
      headerActions={headerActions}
      footer={footerContent}
      className="describe-modal"
      width="800px"
      data-testid="describe-modal"
    >
      {loading ? (
        <div className="state-container">
          <Loader2 className="spinner" size={32} />
          <p>Describing {resourceName}...</p>
        </div>
      ) : error ? (
        <div className="state-container">
          <p className="error-title">Error</p>
          <p className="error-message">{error}</p>
        </div>
      ) : (
        <pre ref={contentRef} className="content-text code-block">
          {output || 'No output available'}
        </pre>
      )}
    </BaseModal>
  );
}
