import { useState } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import type { ManifestFolder } from '../../types.d';
import {
  FOLDER_DRAG_TYPE,
  MANIFEST_DRAG_TYPE,
  getDragPayload,
  hasDragType,
} from './manifest-dnd';

interface FolderBreadcrumbsProps {
  /** Path from root to the current folder. */
  breadcrumbs: ManifestFolder[];
  onNavigate: (folderId: number | null) => void;
  onDropManifest: (manifestId: number, targetFolderId: number | null) => void;
  onDropFolder: (folderId: number, targetFolderId: number | null) => void;
}

interface CrumbProps {
  label: React.ReactNode;
  title: string;
  targetFolderId: number | null;
  isCurrent: boolean;
  onNavigate: FolderBreadcrumbsProps['onNavigate'];
  onDropManifest: FolderBreadcrumbsProps['onDropManifest'];
  onDropFolder: FolderBreadcrumbsProps['onDropFolder'];
}

function Crumb({
  label,
  title,
  targetFolderId,
  isCurrent,
  onNavigate,
  onDropManifest,
  onDropFolder,
}: CrumbProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const acceptsDrag = (e: React.DragEvent) =>
    hasDragType(e, MANIFEST_DRAG_TYPE) || hasDragType(e, FOLDER_DRAG_TYPE);

  return (
    <button
      className={`folder-breadcrumbs__crumb ${
        isCurrent ? 'folder-breadcrumbs__crumb--current' : ''
      } ${isDragOver ? 'folder-breadcrumbs__crumb--drag-over' : ''}`}
      title={title}
      onClick={() => onNavigate(targetFolderId)}
      onDragOver={(e) => {
        if (!acceptsDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        if (!acceptsDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const manifestId = getDragPayload(e, MANIFEST_DRAG_TYPE);
        if (manifestId !== null) {
          onDropManifest(manifestId, targetFolderId);
          return;
        }
        const folderId = getDragPayload(e, FOLDER_DRAG_TYPE);
        if (folderId !== null) {
          onDropFolder(folderId, targetFolderId);
        }
      }}
    >
      {label}
    </button>
  );
}

export function FolderBreadcrumbs({
  breadcrumbs,
  onNavigate,
  onDropManifest,
  onDropFolder,
}: FolderBreadcrumbsProps) {
  return (
    <nav className="folder-breadcrumbs" aria-label="Folder navigation">
      <Crumb
        label={
          <>
            <Home size={14} />
            <span>All Manifests</span>
          </>
        }
        title="All Manifests"
        targetFolderId={null}
        isCurrent={breadcrumbs.length === 0}
        onNavigate={onNavigate}
        onDropManifest={onDropManifest}
        onDropFolder={onDropFolder}
      />
      {breadcrumbs.map((folder, index) => (
        <span key={folder.id} className="folder-breadcrumbs__segment">
          <ChevronRight size={14} className="folder-breadcrumbs__separator" />
          <Crumb
            label={<span>{folder.name}</span>}
            title={folder.name}
            targetFolderId={folder.id}
            isCurrent={index === breadcrumbs.length - 1}
            onNavigate={onNavigate}
            onDropManifest={onDropManifest}
            onDropFolder={onDropFolder}
          />
        </span>
      ))}
    </nav>
  );
}
