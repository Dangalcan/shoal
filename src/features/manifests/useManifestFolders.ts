import { useMemo, useState } from 'react';
import { useApi } from '../../services/api-context';
import { useAsyncData } from '../../hooks/useAsyncData';
import { handleAsyncOperation } from '../../lib/async-operation-handler';
import type { FolderDeleteMode, ManifestFolder } from '../../types.d';
import type { Result } from '../../types/result';

export interface UseManifestFoldersOptions {
  /** Called after an operation that changes manifest rows (moves, recursive deletes). */
  onManifestsChanged?: () => void | Promise<void>;
}

export interface UseManifestFoldersResult {
  folders: ManifestFolder[];
  foldersLoading: boolean;
  currentFolderId: number | null;
  currentFolder: ManifestFolder | null;
  /** Path from the root to the current folder (root itself excluded). */
  breadcrumbs: ManifestFolder[];
  /** Direct children of the current folder, sorted by name. */
  childFolders: ManifestFolder[];
  openFolder: (id: number | null) => void;
  createFolder: (name: string) => Promise<Result<number>>;
  renameFolder: (id: number, name: string) => Promise<Result<number>>;
  deleteFolder: (
    id: number,
    mode: FolderDeleteMode
  ) => Promise<Result<boolean>>;
  moveFolder: (id: number, parentId: number | null) => Promise<Result<boolean>>;
  moveManifestToFolder: (
    manifestId: number,
    folderId: number | null
  ) => Promise<Result<boolean>>;
  /** The folder's own id plus every descendant folder id. */
  getSubtreeIds: (id: number) => Set<number>;
}

export function useManifestFolders(
  options: UseManifestFoldersOptions = {}
): UseManifestFoldersResult {
  const api = useApi();
  const { onManifestsChanged } = options;

  const {
    data: foldersData,
    loading: foldersLoading,
    refetch: refetchFolders,
  } = useAsyncData<ManifestFolder[]>({
    fetchFn: () => api.getManifestFolders(),
    errorTitle: 'Failed to fetch folders',
  });
  const folders = useMemo(() => foldersData ?? [], [foldersData]);

  const [requestedFolderId, setRequestedFolderId] = useState<number | null>(
    null
  );

  const folderById = useMemo(
    () => new Map(folders.map((f) => [f.id, f])),
    [folders]
  );

  // Derived: if the requested folder disappears (deleted elsewhere), fall
  // back to the root instead of showing an orphaned view.
  const currentFolderId =
    requestedFolderId !== null &&
    foldersData !== null &&
    !folderById.has(requestedFolderId)
      ? null
      : requestedFolderId;

  const breadcrumbs = useMemo(() => {
    const path: ManifestFolder[] = [];
    const visited = new Set<number>();
    let cursor = currentFolderId;
    while (cursor !== null && !visited.has(cursor)) {
      visited.add(cursor);
      const folder = folderById.get(cursor);
      if (!folder) break;
      path.unshift(folder);
      cursor = folder.parent_id;
    }
    return path;
  }, [currentFolderId, folderById]);

  const childFolders = useMemo(
    () => folders.filter((f) => f.parent_id === currentFolderId),
    [folders, currentFolderId]
  );

  const currentFolder =
    currentFolderId !== null ? (folderById.get(currentFolderId) ?? null) : null;

  const getSubtreeIds = (id: number): Set<number> => {
    const subtree = new Set<number>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const folder of folders) {
        if (
          folder.parent_id !== null &&
          subtree.has(folder.parent_id) &&
          !subtree.has(folder.id)
        ) {
          subtree.add(folder.id);
          grew = true;
        }
      }
    }
    return subtree;
  };

  const createFolder = (name: string) =>
    handleAsyncOperation(
      () => api.saveManifestFolder({ name, parent_id: currentFolderId }),
      {
        loadingMessage: `Creating folder "${name}"...`,
        successMessage: `Folder "${name}" created.`,
        errorTitle: 'Failed to create folder',
        onSuccess: refetchFolders,
      }
    );

  const renameFolder = (id: number, name: string) =>
    handleAsyncOperation(() => api.saveManifestFolder({ id, name }), {
      loadingMessage: 'Renaming folder...',
      successMessage: `Folder renamed to "${name}".`,
      errorTitle: 'Failed to rename folder',
      onSuccess: refetchFolders,
    });

  const deleteFolder = (id: number, mode: FolderDeleteMode) =>
    handleAsyncOperation(() => api.deleteManifestFolder(id, mode), {
      loadingMessage: 'Deleting folder...',
      successMessage: 'Folder deleted.',
      errorTitle: 'Failed to delete folder',
      onSuccess: async () => {
        await refetchFolders();
        await onManifestsChanged?.();
      },
    });

  const moveFolder = (id: number, parentId: number | null) =>
    handleAsyncOperation(() => api.moveManifestFolder(id, parentId), {
      loadingMessage: 'Moving folder...',
      successMessage: 'Folder moved.',
      errorTitle: 'Failed to move folder',
      onSuccess: refetchFolders,
    });

  const moveManifestToFolder = (manifestId: number, folderId: number | null) =>
    handleAsyncOperation(() => api.moveManifest(manifestId, folderId), {
      loadingMessage: 'Moving manifest...',
      successMessage: 'Manifest moved.',
      errorTitle: 'Failed to move manifest',
      onSuccess: async () => {
        await onManifestsChanged?.();
      },
    });

  return {
    folders,
    foldersLoading,
    currentFolderId,
    currentFolder,
    breadcrumbs,
    childFolders,
    openFolder: setRequestedFolderId,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    moveManifestToFolder,
    getSubtreeIds,
  };
}
