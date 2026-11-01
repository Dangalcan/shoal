import { Box, Loader2, AlertCircle } from 'lucide-react';
import { BaseModal } from './BaseModal';
import { useApi } from '../../services/api-context';
import { useAsyncData } from '../../hooks/useAsyncData';
import { StatusBadge } from '../ui';
import type { Pod } from '../../types/k8s-types';
import type { Result } from '../../types/result';

interface PodViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusterName: string;
}

export function PodViewerModal({
  isOpen,
  onClose,
  clusterName,
}: PodViewerModalProps) {
  const api = useApi();
  // Fetched on every opening and whenever the cluster changes while open.
  const { data, loading, error } = useAsyncData<Pod[]>({
    // get-pods lists the pods kind only, so the rows are Pods.
    fetchFn: () => api.getPods(clusterName) as Promise<Result<Pod[]>>,
    skipInitialFetch: !isOpen || !clusterName,
    dependencies: [isOpen, clusterName],
  });
  const pods = data ?? [];

  const footerContent = (
    <button onClick={onClose} className="close-footer-button">
      Close
    </button>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Pods in ${clusterName}`}
      subtitle="Pods from all namespaces"
      icon={<Box size={20} />}
      footer={footerContent}
      className="pod-modal"
      data-testid="pod-modal"
      width="90%"
      maxWidth="1200px"
    >
      {loading ? (
        <div className="state-container">
          <Loader2 className="spinner" size={32} />
          <p>Fetching pods details...</p>
        </div>
      ) : error ? (
        <div className="state-container">
          <AlertCircle size={32} className="pod-error-icon" />
          <p className="error-title">Error</p>
          <p className="error-message">{error}</p>
        </div>
      ) : pods.length > 0 ? (
        <div className="modal-table-container">
          <table className="modal-table">
            <thead className="modal-table-head">
              <tr>
                <th>Namespace</th>
                <th>Name</th>
                <th>Status</th>
                <th>Ready</th>
              </tr>
            </thead>
            <tbody className="modal-table-body">
              {pods.map((pod, idx) => {
                const status = pod.status?.phase ?? 'Unknown';
                const isRunning = status === 'Running';
                const readyCount =
                  pod.status?.containerStatuses?.filter((s) => s.ready)
                    .length || 0;
                const totalCount = pod.spec?.containers.length ?? 0;
                return (
                  <tr key={idx} className="modal-table-row">
                    <td className="modal-mono-cell">
                      {pod.metadata.namespace}
                    </td>
                    <td title={pod.metadata.name} style={{ fontWeight: 500 }}>
                      {pod.metadata.name}
                    </td>
                    <td>
                      <StatusBadge
                        label={status}
                        variant={isRunning ? 'success' : 'warning'}
                      />
                    </td>
                    <td className="modal-mono-cell">
                      {readyCount}/{totalCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="state-container">
          <Box size={48} className="pod-empty-icon" />
          <p>No pods found in this context.</p>
        </div>
      )}
    </BaseModal>
  );
}
