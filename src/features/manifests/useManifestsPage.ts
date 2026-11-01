import { useState, useMemo } from 'react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useApi } from '../../services/api-context';
import { useClusterContext } from '../clusters/ClusterContext';
import type { Manifest } from '../../types.d';
import { useManifestFolders } from './useManifestFolders';
import { useManifestEditor } from './useManifestEditor';
import { useManifestImport } from './useManifestImport';
import { useManifestActions } from './useManifestActions';
import { useManifestFolderDialogs } from './useManifestFolderDialogs';

/**
 * The manifest library page: the manifests of the current folder, the
 * folder tree and its dialogs, the editor, file import, apply and delete.
 */
export function useManifestsPage() {
  const api = useApi();
  const {
    data: manifestsData,
    loading,
    error: manifestsError,
    refetch: fetchManifests,
  } = useAsyncData<Manifest[]>({
    fetchFn: async () => {
      const result = await api.getManifests();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch manifests');
      }
      return result.data ?? [];
    },
    errorTitle: 'Failed to fetch manifests',
  });
  const manifests = useMemo(() => manifestsData ?? [], [manifestsData]);

  const folders = useManifestFolders({ onManifestsChanged: fetchManifests });
  const { currentFolderId, foldersError, refetchFolders } = folders;
  const folderDialogs = useManifestFolderDialogs(folders);

  // Both lists come from the same database, so one failure is shown and one
  // Retry reloads both; the toast already carries each title.
  const loadError = manifestsError ?? foldersError;
  const retryLoad = async () => {
    await Promise.all([fetchManifests(), refetchFolders()]);
  };

  // New manifests are stored under the context the sidebar shows (known
  // since start-up, updated on every switch), never a slower read of its own.
  const { currentContext: activeContext } = useClusterContext();

  const editor = useManifestEditor({
    save: (editingId, form) =>
      api.saveManifest({
        id: editingId || undefined,
        name: form.name,
        content: form.content,
        cluster_context: activeContext || 'default',
        // Only new manifests land in the current folder; edits keep their location.
        ...(editingId ? {} : { folder_id: currentFolderId }),
      }),
    onSaved: fetchManifests,
  });

  const importer = useManifestImport({
    saveImported: ({ name, content }) =>
      api.saveManifest({
        name,
        content,
        cluster_context: activeContext || 'default',
        folder_id: currentFolderId,
      }),
    onImported: fetchManifests,
  });

  const actions = useManifestActions(fetchManifests);
  const [isExamplesOpen, setIsExamplesOpen] = useState(false);

  const visibleManifests = useMemo(
    () => manifests.filter((m) => (m.folder_id ?? null) === currentFolderId),
    [manifests, currentFolderId]
  );

  const folderItemCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const m of manifests) {
      if (m.folder_id != null) {
        counts.set(m.folder_id, (counts.get(m.folder_id) ?? 0) + 1);
      }
    }
    for (const f of folders.folders) {
      if (f.parent_id != null) {
        counts.set(f.parent_id, (counts.get(f.parent_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [manifests, folders.folders]);

  return {
    manifests,
    loading,
    /** Why the manifests or the folders could not be loaded; null when both loaded. */
    loadError,
    retryLoad,
    visibleManifests,
    folderItemCounts,
    isEmpty: visibleManifests.length === 0 && folders.childFolders.length === 0,
    folders,
    folderDialogs,
    editor,
    importer,
    actions,
    isExamplesOpen,
    setIsExamplesOpen,
  };
}
