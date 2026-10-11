import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FolderNameModal } from '../../../features/manifests/FolderNameModal';
import { DeleteFolderModal } from '../../../features/manifests/DeleteFolderModal';
import type { ManifestFolder } from '../../../types.d';

describe('FolderNameModal', () => {
  it('creates a folder with the trimmed name on Enter', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<FolderNameModal onClose={onClose} onSubmit={onSubmit} />);

    expect(screen.getByText('New Folder')).toBeInTheDocument();
    const input = screen.getByLabelText('Folder Name');
    fireEvent.change(input, { target: { value: '  Staging  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith('Staging');
    expect(onClose).toHaveBeenCalled();
  });

  it('ignores a blank name and other keys', () => {
    const onSubmit = vi.fn();
    render(<FolderNameModal onClose={vi.fn()} onSubmit={onSubmit} />);

    const input = screen.getByLabelText('Folder Name');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'a' });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('renames when given an initial name, and cancel closes', () => {
    const onClose = vi.fn();
    render(
      <FolderNameModal
        onClose={onClose}
        initialName="Prod"
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Rename Folder')).toBeInTheDocument();
    expect(screen.getByLabelText('Folder Name')).toHaveValue('Prod');
    expect(screen.getByRole('button', { name: 'Rename' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('DeleteFolderModal', () => {
  const folder: ManifestFolder = {
    id: 4,
    name: 'Old stuff',
    parent_id: null,
    created_at: '2026-10-01 10:00:00',
    updated_at: '2026-10-01 10:00:00',
  };

  it('moves the contents up by default', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <DeleteFolderModal
        folder={folder}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('Old stuff')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Folder' }));

    expect(onConfirm).toHaveBeenCalledWith(4, 'move-to-parent');
    expect(onClose).toHaveBeenCalled();
  });

  it('warns and deletes everything when the box is ticked', () => {
    const onConfirm = vi.fn();
    render(
      <DeleteFolderModal
        folder={folder}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    expect(screen.queryByText(/permanently deletes/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText(/permanently deletes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Folder' }));

    expect(onConfirm).toHaveBeenCalledWith(4, 'recursive');
  });

  it('cancels without deleting', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <DeleteFolderModal
        folder={folder}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
