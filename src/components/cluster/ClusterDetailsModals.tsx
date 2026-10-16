import { LogViewerModal } from '../modals/LogViewerModal';
import { DescribeModal } from '../modals/DescribeModal';
import { YamlModal } from '../modals/YamlModal';
import { ConfirmModal } from '../modals/ConfirmModal';
import { PodTerminalModal } from '../modals/PodTerminalModal';
import { PortForwardModal } from '../modals/PortForwardModal';
import { ScaleResourceModal } from '../modals/ScaleResourceModal';
import { isPod } from '../../lib/type-guards';
import { getForwardablePorts } from '../../features/portforward/port-utils';
import { deleteClusterDialogText } from '../../features/clusters/provider';
import type { ClusterDeletion } from '../../features/clusters/useClusterDeletion';
import type { ResourceType } from '../../lib/resources/resource-definitions';
import type { K8sResource } from '../../types/k8s-types';
import type { useModalState } from '../../hooks';

interface ClusterDetailsModalsProps {
  /** Context name; empty when the route carries none. */
  name: string;
  activeTab: ResourceType;
  modals: ReturnType<typeof useModalState>;
  onDeleteItem: (item: K8sResource) => void;
  onScaleItem: (item: K8sResource, replicas: number) => void;
  clusterDeletion: ClusterDeletion;
}

/** Container names of a pod row, for the log viewer's picker. */
function containerNames(item: K8sResource | null): string[] | undefined {
  if (!item || !isPod(item)) return undefined;
  return (item.spec?.containers ?? []).map((c) => c.name);
}

/** Replica count of a scalable row (0 when the row has none). */
function replicasOf(item: K8sResource | null): number {
  return (item?.spec as { replicas?: number } | undefined)?.replicas ?? 0;
}

/** The row modals of the cluster details page plus the cluster deletion dialog. */
export function ClusterDetailsModals({
  name,
  activeTab,
  modals,
  onDeleteItem,
  onScaleItem,
  clusterDeletion,
}: ClusterDetailsModalsProps) {
  const item = modals.selectedItem;
  const itemName = item?.metadata.name ?? '';
  const itemNamespace = item?.metadata.namespace ?? '';
  const forwardType = activeTab === 'services' ? 'service' : 'pod';

  return (
    <>
      <LogViewerModal
        isOpen={modals.activeModal === 'logs'}
        onClose={modals.closeAll}
        clusterName={name}
        podName={itemName}
        namespace={itemNamespace}
        containers={containerNames(item)}
      />
      <DescribeModal
        isOpen={modals.activeModal === 'describe'}
        onClose={modals.closeAll}
        clusterName={name}
        resourceName={itemName}
        resourceType={activeTab}
        namespace={itemNamespace}
      />
      <YamlModal
        isOpen={modals.activeModal === 'yaml'}
        onClose={modals.closeAll}
        clusterName={name}
        resourceName={itemName}
        resourceType={activeTab}
        namespace={itemNamespace}
      />

      <ConfirmModal
        isOpen={modals.activeModal === 'delete'}
        onClose={modals.closeAll}
        onConfirm={() => {
          if (item) onDeleteItem(item);
          modals.closeAll();
        }}
        title={`Delete ${activeTab}`}
        message={`Are you sure you want to delete ${activeTab}/${item?.metadata.name}? This action cannot be undone.`}
        confirmLabel={`Delete ${activeTab}`}
        variant="danger"
      />

      <ConfirmModal
        isOpen={clusterDeletion.isOpen}
        onClose={clusterDeletion.close}
        onConfirm={clusterDeletion.confirm}
        {...deleteClusterDialogText(name)}
        variant="danger"
        loading={clusterDeletion.deleting}
      />
      <PodTerminalModal
        isOpen={modals.activeModal === 'exec'}
        onClose={modals.closeAll}
        podName={itemName}
        namespace={itemNamespace}
        contextName={name}
      />
      <ScaleResourceModal
        isOpen={modals.activeModal === 'scale'}
        onClose={modals.closeAll}
        onScale={(replicas) => {
          if (item) onScaleItem(item, replicas);
        }}
        resourceType={activeTab}
        resourceName={itemName}
        currentReplicas={replicasOf(item)}
      />
      <PortForwardModal
        isOpen={modals.activeModal === 'forward'}
        onClose={modals.closeAll}
        contextName={name}
        namespace={item?.metadata.namespace ?? 'default'}
        resourceType={forwardType}
        resourceName={itemName}
        suggestedPorts={item ? getForwardablePorts(item, forwardType) : []}
      />
    </>
  );
}
