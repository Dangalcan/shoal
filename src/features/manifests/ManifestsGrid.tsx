import { FileUp } from 'lucide-react';
import { ManifestCard } from './ManifestCard';
import { FolderCard } from './FolderCard';
import { activateOnKey } from '../../lib/a11y';
import type { Manifest, ManifestFolder } from '../../types.d';
import type { UseManifestImportResult } from './useManifestImport';

interface ManifestsGridProps {
  childFolders: ManifestFolder[];
  folderItemCounts: Map<number, number>;
  manifests: Manifest[];
  /** True while the first load is still running. */
  loading: boolean;
  /** Nothing to show in the current folder. */
  isEmpty: boolean;
  /** The folder being shown; null at the root. */
  currentFolderId: number | null;
  importer: UseManifestImportResult;
  /** Opens the file picker (the empty state doubles as the upload button). */
  onUploadClick: () => void;
  applying: number | null;
  onApply: (id: number) => void;
  onEdit: (manifest: Manifest) => void;
  onMoveManifest: (manifest: Manifest) => void;
  onDeleteManifest: (id: number) => void;
  onOpenFolder: (id: number | null) => void;
  onRenameFolder: (folder: ManifestFolder) => void;
  onMoveFolder: (folder: ManifestFolder) => void;
  onDeleteFolder: (folder: ManifestFolder) => void;
  onDropManifest: (manifestId: number, targetFolderId: number) => void;
  onDropFolder: (folderId: number, targetFolderId: number) => void;
}

/**
 * The folder and manifest cards of the current folder. The whole area is a
 * drop zone for YAML files.
 */
export function ManifestsGrid({
  childFolders,
  folderItemCounts,
  manifests,
  loading,
  isEmpty,
  currentFolderId,
  importer,
  onUploadClick,
  applying,
  onApply,
  onEdit,
  onMoveManifest,
  onDeleteManifest,
  onOpenFolder,
  onRenameFolder,
  onMoveFolder,
  onDeleteFolder,
  onDropManifest,
  onDropFolder,
}: ManifestsGridProps) {
  return (
    <div
      className={`manifests-grid-container ${importer.isDragging ? 'is-dragging' : ''}`}
      onDragOver={importer.onDragOver}
      onDragEnter={importer.onDragOver}
      onDragLeave={importer.onDragLeave}
      onDrop={importer.onDrop}
    >
      {childFolders.length > 0 && (
        <div className="folders-grid">
          {childFolders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              itemCount={folderItemCounts.get(folder.id) ?? 0}
              onOpen={onOpenFolder}
              onRename={onRenameFolder}
              onMove={onMoveFolder}
              onDelete={onDeleteFolder}
              onDropManifest={onDropManifest}
              onDropFolder={onDropFolder}
            />
          ))}
        </div>
      )}
      <div className="manifests-grid">
        {loading ? (
          <p>Loading manifests...</p>
        ) : isEmpty ? (
          <div
            className="empty-state drop-zone"
            onClick={onUploadClick}
            onKeyDown={(e) => activateOnKey(e, onUploadClick)}
            role="button"
            tabIndex={0}
          >
            <FileUp size={48} className="empty-icon" />
            <p>
              {currentFolderId === null
                ? 'No saved manifests found.'
                : 'This folder is empty.'}
            </p>
            <span>
              Click here to upload or drag & drop your YAML files anywhere.
            </span>
          </div>
        ) : (
          manifests.map((m) => (
            <ManifestCard
              key={m.id}
              manifest={m}
              applying={applying}
              onApply={onApply}
              onEdit={onEdit}
              onMove={onMoveManifest}
              onDelete={onDeleteManifest}
            />
          ))
        )}
      </div>
    </div>
  );
}
