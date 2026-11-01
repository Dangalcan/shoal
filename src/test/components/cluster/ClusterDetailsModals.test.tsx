import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../utils';
import { ClusterDetailsModals } from '../../../components/cluster/ClusterDetailsModals';
import type { ClusterDeletion } from '../../../features/clusters/useClusterDeletion';
import type { useModalState } from '../../../hooks';
import type { K8sResource } from '../../../types/k8s-types';

/**
 * The scale and delete dialogs of the cluster details page hand the selected
 * row to the page, and only close when no row is selected.
 */

type Modals = ReturnType<typeof useModalState>;

const deployment = {
  metadata: { name: 'web', namespace: 'shop' },
  spec: { replicas: 2 },
} as unknown as K8sResource;

function renderModals(
  activeModal: Modals['activeModal'],
  selectedItem: K8sResource | null
) {
  const modals: Modals = {
    selectedItem,
    activeModal,
    openDescribe: vi.fn(),
    openYaml: vi.fn(),
    openLogs: vi.fn(),
    openDelete: vi.fn(),
    openExec: vi.fn(),
    openForward: vi.fn(),
    openScale: vi.fn(),
    closeAll: vi.fn(),
  };
  const clusterDeletion: ClusterDeletion = {
    isOpen: false,
    deleting: false,
    open: vi.fn(),
    close: vi.fn(),
    confirm: vi.fn(),
  };
  const onDeleteItem = vi.fn();
  const onScaleItem = vi.fn();
  render(
    <ClusterDetailsModals
      name="kind-dev"
      activeTab="deployments"
      modals={modals}
      onDeleteItem={onDeleteItem}
      onScaleItem={onScaleItem}
      clusterDeletion={clusterDeletion}
    />
  );
  return { modals, onDeleteItem, onScaleItem };
}

describe('ClusterDetailsModals', () => {
  it('scales the selected row to the chosen count', () => {
    const { modals, onScaleItem } = renderModals('scale', deployment);
    const input = screen.getByLabelText('Replica count');
    expect(input).toHaveValue(2);

    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Scale to 5' }));

    expect(onScaleItem).toHaveBeenCalledWith(deployment, 5);
    expect(modals.closeAll).toHaveBeenCalled();
  });

  it('only closes the scale dialog when no row is selected', () => {
    const { modals, onScaleItem } = renderModals('scale', null);
    const input = screen.getByLabelText('Replica count');
    expect(input).toHaveValue(0);

    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Scale to 3' }));

    expect(onScaleItem).not.toHaveBeenCalled();
    expect(modals.closeAll).toHaveBeenCalled();
  });

  it('deletes the selected row on confirmation', () => {
    const { modals, onDeleteItem } = renderModals('delete', deployment);
    expect(
      screen.getByText(
        'Are you sure you want to delete deployments/web? This action cannot be undone.'
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete deployments' }));

    expect(onDeleteItem).toHaveBeenCalledWith(deployment);
    expect(modals.closeAll).toHaveBeenCalled();
  });

  it('only closes the delete dialog when no row is selected', () => {
    const { modals, onDeleteItem } = renderModals('delete', null);

    fireEvent.click(screen.getByRole('button', { name: 'Delete deployments' }));

    expect(onDeleteItem).not.toHaveBeenCalled();
    expect(modals.closeAll).toHaveBeenCalled();
  });
});
