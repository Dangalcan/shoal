import { AlertCircle, FileUp } from 'lucide-react';
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
  /** Why the library could not be loaded; null when the last load succeeded. */
  error: string | null;
  /** Loads the library again (the error state's Retry button). */
  onRetry: () => void | Promise<void>;
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

interface LoadErrorProps {
  error: string;
  /** True while the retry is in flight. */
  retrying: boolean;
  onRetry: () => void | Promise<void>;
}

/**
 * Replaces the empty state when the library could not be read: a locked or
 * corrupt database must not look like a library with nothing in it.
 */
function LoadError({ error, retrying, onRetry }: LoadErrorProps) {
  return (
    <div className="manifests-load-error" role="alert">
      <AlertCircle size={48} className="manifests-load-error__icon" />
      <p className="manifests-load-error__title">
        The manifest library could not be loaded.
      </p>
      <p className="manifests-load-error__message">{error}</p>
      <button
        type="button"
        className="manifests-load-error__retry"
        onClick={onRetry}
        disabled={retrying}
      >
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  );
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
  error,
  onRetry,
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
        {error && isEmpty ? (
          // Cards already on screen stay (the toast reported the failure);
          // the error stays up while the retry runs instead of a spinner.
          <LoadError error={error} retrying={loading} onRetry={onRetry} />
        ) : loading ? (
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
