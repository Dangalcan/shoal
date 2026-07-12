import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MoveToFolderModal } from '../../../features/manifests/MoveToFolderModal';
import type { ManifestFolder } from '../../../types.d';

function makeFolder(overrides: Partial<ManifestFolder>): ManifestFolder {
  return {
    id: 1,
    name: 'folder',
    parent_id: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

const folders = [
  makeFolder({ id: 1, name: 'infra' }),
  makeFolder({ id: 2, name: 'apps' }),
  makeFolder({ id: 3, name: 'nginx', parent_id: 1 }),
];

describe('MoveToFolderModal', () => {
  const onMove = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (
    props: Partial<React.ComponentProps<typeof MoveToFolderModal>> = {}
  ) =>
    render(
      <MoveToFolderModal
        onClose={onClose}
        itemName="my-manifest"
        folders={folders}
        currentLocationId={null}
        onMove={onMove}
        {...props}
      />
    );

  it('renders the root option and the folder tree', () => {
    renderModal();
    expect(screen.getByText('All Manifests')).toBeInTheDocument();
    expect(screen.getByText('infra')).toBeInTheDocument();
    expect(screen.getByText('apps')).toBeInTheDocument();
    expect(screen.getByText('nginx')).toBeInTheDocument();
  });

  it('disables Move Here until a destination is picked', () => {
    renderModal();
    expect(screen.getByText('Move Here').closest('button')).toBeDisabled();
  });

  it('moves to the selected folder', () => {
    renderModal();
    fireEvent.click(screen.getByText('infra'));
    fireEvent.click(screen.getByText('Move Here'));

    expect(onMove).toHaveBeenCalledWith(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('moves to the root when All Manifests is selected', () => {
    renderModal({ currentLocationId: 1 });
    fireEvent.click(screen.getByText('All Manifests'));
    fireEvent.click(screen.getByText('Move Here'));

    expect(onMove).toHaveBeenCalledWith(null);
  });

  it('disables the current location', () => {
    renderModal({ currentLocationId: 2 });
    expect(screen.getByText('apps').closest('button')).toBeDisabled();
  });

  it('disables the moved folder subtree', () => {
    renderModal({ disabledIds: new Set([1, 3]) });
    expect(screen.getByText('infra').closest('button')).toBeDisabled();
    expect(screen.getByText('nginx').closest('button')).toBeDisabled();
    expect(screen.getByText('apps').closest('button')).not.toBeDisabled();
  });
});
