import { useState } from 'react';
import { Folder, FolderInput, Pencil, Trash2 } from 'lucide-react';
import type { ManifestFolder } from '../../types.d';
import {
  FOLDER_DRAG_TYPE,
  MANIFEST_DRAG_TYPE,
  getDragPayload,
  hasDragType,
  setDragPayload,
} from './manifest-dnd';

interface FolderCardProps {
  folder: ManifestFolder;
  /** Number of manifests + subfolders directly inside. */
  itemCount: number;
  onOpen: (id: number) => void;
  onRename: (folder: ManifestFolder) => void;
  onMove: (folder: ManifestFolder) => void;
  onDelete: (folder: ManifestFolder) => void;
  onDropManifest: (manifestId: number, targetFolderId: number) => void;
  onDropFolder: (folderId: number, targetFolderId: number) => void;
}

export function FolderCard({
  folder,
  itemCount,
  onOpen,
  onRename,
  onMove,
  onDelete,
  onDropManifest,
  onDropFolder,
}: FolderCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const acceptsDrag = (e: React.DragEvent) =>
    hasDragType(e, MANIFEST_DRAG_TYPE) || hasDragType(e, FOLDER_DRAG_TYPE);

  const handleDragOver = (e: React.DragEvent) => {
    if (!acceptsDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!acceptsDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const manifestId = getDragPayload(e, MANIFEST_DRAG_TYPE);
    if (manifestId !== null) {
      onDropManifest(manifestId, folder.id);
      return;
    }
    const folderId = getDragPayload(e, FOLDER_DRAG_TYPE);
    if (folderId !== null && folderId !== folder.id) {
      onDropFolder(folderId, folder.id);
    }
  };

  return (
    <div
      className={`folder-card ${isDragOver ? 'folder-card--drag-over' : ''}`}
      role="button"
      tabIndex={0}
      draggable
      onClick={() => onOpen(folder.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(folder.id);
        }
      }}
      onDragStart={(e) => setDragPayload(e, FOLDER_DRAG_TYPE, folder.id)}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="folder-card__icon">
        <Folder size={22} />
      </div>
      <div className="folder-card__info">
        <h3 className="folder-card__name" title={folder.name}>
          {folder.name}
        </h3>
        <span className="folder-card__count">
          {itemCount} item{itemCount === 1 ? '' : 's'}
        </span>
      </div>
      <div
        className="folder-card__actions"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="btn-icon"
          title="Rename Folder"
          onClick={() => onRename(folder)}
        >
          <Pencil size={14} />
        </button>
        <button
          className="btn-icon"
          title="Move Folder"
          onClick={() => onMove(folder)}
        >
          <FolderInput size={14} />
        </button>
        <button
          className="btn-icon btn-delete"
          title="Delete Folder"
          onClick={() => onDelete(folder)}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
