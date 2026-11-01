import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FolderCard } from '../../../features/manifests/FolderCard';
import {
  FOLDER_DRAG_TYPE,
  MANIFEST_DRAG_TYPE,
} from '../../../features/manifests/manifest-dnd';
import type { ManifestFolder } from '../../../types.d';

const folder: ManifestFolder = {
  id: 7,
  name: 'production',
  parent_id: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

describe('FolderCard', () => {
  const onOpen = vi.fn();
  const onRename = vi.fn();
  const onMove = vi.fn();
  const onDelete = vi.fn();
  const onDropManifest = vi.fn();
  const onDropFolder = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderCard = (itemCount = 3) =>
    render(
      <FolderCard
        folder={folder}
        itemCount={itemCount}
        onOpen={onOpen}
        onRename={onRename}
        onMove={onMove}
        onDelete={onDelete}
        onDropManifest={onDropManifest}
        onDropFolder={onDropFolder}
      />
    );

  it('shows the folder name and item count', () => {
    renderCard(3);
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.getByText('3 items')).toBeInTheDocument();
  });

  it('uses singular wording for one item', () => {
    renderCard(1);
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });

  it('opens the folder on click', () => {
    renderCard();
    fireEvent.click(screen.getByText('production'));
    expect(onOpen).toHaveBeenCalledWith(7);
  });

  it('opens the folder with the keyboard', () => {
    renderCard();
    fireEvent.keyDown(screen.getByRole('button', { name: /production/i }), {
      key: 'Enter',
    });
    expect(onOpen).toHaveBeenCalledWith(7);
  });

  it('opens the folder with the space key and starts a typed folder drag', () => {
    renderCard();
    const card = screen.getByRole('button', { name: /production/i });
    const setData = vi.fn();

    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.dragStart(card, { dataTransfer: { setData } });

    expect(onOpen).toHaveBeenCalledWith(7);
    expect(setData).toHaveBeenCalledWith(FOLDER_DRAG_TYPE, '7');
  });

  it('fires action callbacks without opening the folder', () => {
    renderCard();
    fireEvent.click(screen.getByTitle('Rename Folder'));
    fireEvent.click(screen.getByTitle('Move Folder'));
    fireEvent.click(screen.getByTitle('Delete Folder'));

    expect(onRename).toHaveBeenCalledWith(folder);
    expect(onMove).toHaveBeenCalledWith(folder);
    expect(onDelete).toHaveBeenCalledWith(folder);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('accepts a dropped manifest', () => {
    renderCard();
    fireEvent.drop(screen.getByRole('button', { name: /production/i }), {
      dataTransfer: {
        types: [MANIFEST_DRAG_TYPE],
        getData: (type: string) => (type === MANIFEST_DRAG_TYPE ? '42' : ''),
      },
    });
    expect(onDropManifest).toHaveBeenCalledWith(42, 7);
  });

  it('accepts a dropped folder', () => {
    renderCard();
    fireEvent.drop(screen.getByRole('button', { name: /production/i }), {
      dataTransfer: {
        types: [FOLDER_DRAG_TYPE],
        getData: (type: string) => (type === FOLDER_DRAG_TYPE ? '3' : ''),
      },
    });
    expect(onDropFolder).toHaveBeenCalledWith(3, 7);
  });

  it('ignores a folder dropped onto itself', () => {
    renderCard();
    fireEvent.drop(screen.getByRole('button', { name: /production/i }), {
      dataTransfer: {
        types: [FOLDER_DRAG_TYPE],
        getData: (type: string) => (type === FOLDER_DRAG_TYPE ? '7' : ''),
      },
    });
    expect(onDropFolder).not.toHaveBeenCalled();
  });

  it('ignores OS file drops', () => {
    renderCard();
    fireEvent.drop(screen.getByRole('button', { name: /production/i }), {
      dataTransfer: { types: ['Files'], getData: () => '' },
    });
    expect(onDropManifest).not.toHaveBeenCalled();
    expect(onDropFolder).not.toHaveBeenCalled();
  });

  it('ignores invalid payloads and clears the drag-over state', () => {
    renderCard();
    const card = screen.getByRole('button', { name: /production/i });

    fireEvent.dragOver(card, {
      dataTransfer: { types: [MANIFEST_DRAG_TYPE], dropEffect: 'none' },
    });
    expect(card).toHaveClass('folder-card--drag-over');

    fireEvent.drop(card, {
      dataTransfer: {
        types: [MANIFEST_DRAG_TYPE],
        getData: () => 'not-a-number',
      },
    });

    expect(card).not.toHaveClass('folder-card--drag-over');
    expect(onDropManifest).not.toHaveBeenCalled();
  });

  it('ignores keys other than Enter and Space', () => {
    renderCard();
    fireEvent.keyDown(screen.getByRole('button', { name: /production/i }), {
      key: 'Escape',
    });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('does not highlight for an OS file drag', () => {
    renderCard();
    const card = screen.getByRole('button', { name: /production/i });

    fireEvent.dragEnter(card, { dataTransfer: { types: ['Files'] } });

    expect(card).not.toHaveClass('folder-card--drag-over');
  });

  it('clears the highlight when the drag leaves', () => {
    renderCard();
    const card = screen.getByRole('button', { name: /production/i });

    fireEvent.dragEnter(card, {
      dataTransfer: { types: [FOLDER_DRAG_TYPE], dropEffect: 'none' },
    });
    expect(card).toHaveClass('folder-card--drag-over');

    fireEvent.dragLeave(card);

    expect(card).not.toHaveClass('folder-card--drag-over');
  });

  it('ignores a typed drop that carries no payload', () => {
    renderCard();
    fireEvent.drop(screen.getByRole('button', { name: /production/i }), {
      dataTransfer: { types: [FOLDER_DRAG_TYPE], getData: () => '' },
    });
    expect(onDropManifest).not.toHaveBeenCalled();
    expect(onDropFolder).not.toHaveBeenCalled();
  });
});
