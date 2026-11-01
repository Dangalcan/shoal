import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ManifestsGrid } from '../../../features/manifests/ManifestsGrid';
import type { UseManifestImportResult } from '../../../features/manifests/useManifestImport';

/**
 * The empty state of the manifest grid doubles as the upload button, from
 * the mouse and from the keyboard.
 */

function renderEmptyGrid(currentFolderId: number | null = null) {
  const importer: UseManifestImportResult = {
    handleFileUpload: vi.fn(),
    isDragging: false,
    onDragOver: vi.fn(),
    onDragLeave: vi.fn(),
    onDrop: vi.fn(),
  };
  const onUploadClick = vi.fn();
  render(
    <ManifestsGrid
      childFolders={[]}
      folderItemCounts={new Map()}
      manifests={[]}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      isEmpty
      currentFolderId={currentFolderId}
      importer={importer}
      onUploadClick={onUploadClick}
      applying={null}
      onApply={vi.fn()}
      onEdit={vi.fn()}
      onMoveManifest={vi.fn()}
      onDeleteManifest={vi.fn()}
      onOpenFolder={vi.fn()}
      onRenameFolder={vi.fn()}
      onMoveFolder={vi.fn()}
      onDeleteFolder={vi.fn()}
      onDropManifest={vi.fn()}
      onDropFolder={vi.fn()}
    />
  );
  return { onUploadClick };
}

const emptyState = () =>
  screen.getByRole('button', { name: /Click here to upload/ });

describe('ManifestsGrid empty state', () => {
  it('opens the file picker with Enter and Space but not other keys', () => {
    const { onUploadClick } = renderEmptyGrid();

    fireEvent.keyDown(emptyState(), { key: 'ArrowDown' });
    expect(onUploadClick).not.toHaveBeenCalled();

    fireEvent.keyDown(emptyState(), { key: 'Enter' });
    fireEvent.keyDown(emptyState(), { key: ' ' });
    expect(onUploadClick).toHaveBeenCalledTimes(2);
  });

  it('opens the file picker on click', () => {
    const { onUploadClick } = renderEmptyGrid();

    fireEvent.click(emptyState());

    expect(onUploadClick).toHaveBeenCalledTimes(1);
  });

  it('names the empty library at the root', () => {
    renderEmptyGrid(null);
    expect(screen.getByText('No saved manifests found.')).toBeInTheDocument();
  });

  it('says the open folder is empty', () => {
    renderEmptyGrid(4);
    expect(screen.getByText('This folder is empty.')).toBeInTheDocument();
  });
});
