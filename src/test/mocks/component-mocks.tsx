/**
 * Common component mock data for integration tests.
 * For page-level tests that need modal mocks, also import modal-mocks.ts.
 */

export const mockModalProps = {
  LogViewerModal: ({ isOpen, onClose, podName }: any) =>
    isOpen ? (
      <div data-testid="log-modal">
        Logs for {podName} <button onClick={onClose}>Close</button>
      </div>
    ) : null,

  DescribeModal: ({ isOpen, onClose, resourceName }: any) =>
    isOpen ? (
      <div data-testid="describe-modal">
        Describe {resourceName} <button onClick={onClose}>Close</button>
      </div>
    ) : null,

  YamlModal: ({ isOpen, onClose, resourceName }: any) =>
    isOpen ? (
      <div data-testid="yaml-modal">
        YAML {resourceName} <button onClick={onClose}>Close</button>
      </div>
    ) : null,

  PodViewerModal: ({ isOpen, onClose, clusterName }: any) =>
    isOpen ? (
      <div data-testid="pod-modal">
        PodViewer for {clusterName} <button onClick={onClose}>Close</button>
      </div>
    ) : null,
};
