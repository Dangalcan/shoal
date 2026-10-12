import { useState, useEffect, useMemo, useRef } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  FileCode,
  Plus,
  Save,
  Edit2,
  Upload,
  FileUp,
  FolderPlus,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApi } from '../services/api-context';
import { Manifest, ManifestFolder } from '../types.d';
import { BaseModal } from '../components/modals/BaseModal';
import { ConfirmModal } from '../components/modals/ConfirmModal';
import { ManifestCard } from '../features/manifests/ManifestCard';
import { FolderCard } from '../features/manifests/FolderCard';
import { FolderBreadcrumbs } from '../features/manifests/FolderBreadcrumbs';
import { FolderNameModal } from '../features/manifests/FolderNameModal';
import { DeleteFolderModal } from '../features/manifests/DeleteFolderModal';
import { MoveToFolderModal } from '../features/manifests/MoveToFolderModal';
import { useManifestFolders } from '../features/manifests/useManifestFolders';
import { isFileDrag } from '../features/manifests/manifest-dnd';
import { ExampleTemplatesModal } from '../features/manifests/ExampleTemplatesModal';
import type { ExampleTemplate } from '../features/manifests/example-templates';

type FolderNameModalState =
  { mode: 'create' } | { mode: 'rename'; folder: ManifestFolder } | null;

type MoveTarget =
  | { kind: 'manifest'; manifest: Manifest }
  | { kind: 'folder'; folder: ManifestFolder }
  | null;

export function Manifests() {
  const api = useApi();
  const {
    data: manifestsData,
    loading,
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

  const {
    folders,
    currentFolderId,
    breadcrumbs,
    childFolders,
    openFolder,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    moveManifestToFolder,
    getSubtreeIds,
  } = useManifestFolders({ onManifestsChanged: fetchManifests });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', content: '' });
  const [applying, setApplying] = useState<number | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<
    number | null
  >(null);
  const [activeContext, setActiveContext] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [folderNameModal, setFolderNameModal] =
    useState<FolderNameModalState>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] =
    useState<ManifestFolder | null>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTarget>(null);
  const [isExamplesOpen, setIsExamplesOpen] = useState(false);
  // Field focused when the editor opens. Uses autoFocus on mount: a delayed
  // focus() call could fire after the user (or a slow machine) had already
  // moved to the other field and steal the typing.
  const [focusField, setFocusField] = useState<'name' | 'content'>('name');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchContext = async () => {
      const result = await api.getCurrentContext();
      if (result.success && result.data) {
        setActiveContext(result.data);
      }
    };
    fetchContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    for (const f of folders) {
      if (f.parent_id != null) {
        counts.set(f.parent_id, (counts.get(f.parent_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [manifests, folders]);

  const handleSave = async () => {
    if (!formData.name || !formData.content) return;

    const result = await api.saveManifest({
      id: editingId || undefined,
      name: formData.name,
      content: formData.content,
      cluster_context: activeContext || 'default',
      // Only new manifests land in the current folder; edits keep their location.
      ...(editingId ? {} : { folder_id: currentFolderId }),
    });

    if (result.success) {
      toast.success(
        editingId
          ? 'Manifest updated successfully'
          : 'Manifest saved successfully'
      );
      setFormData({ name: '', content: '' });
      setEditingId(null);
      setIsModalOpen(false);
      fetchManifests();
    } else {
      toast.error('Failed to save manifest');
    }
  };

  const handleEdit = (manifest: Manifest) => {
    setFormData({ name: manifest.name, content: manifest.content });
    setEditingId(manifest.id);
    setFocusField('content');
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setFormData({ name: '', content: '' });
    setEditingId(null);
    setFocusField('name');
    setIsModalOpen(true);
  };

  const handleExampleSelect = (template: ExampleTemplate) => {
    setFormData({ name: template.name, content: template.content });
    setEditingId(null);
    setFocusField('content');
    setIsModalOpen(true);
  };

  const handleFileRead = (
    file: File
  ): Promise<{ name: string; content: string }> => {
    return new Promise((resolve, reject) => {
      if (
        !file.name.toLowerCase().endsWith('.yaml') &&
        !file.name.toLowerCase().endsWith('.yml')
      ) {
        reject(new Error(`Invalid file type: ${file.name}`));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const target = e.target;
        if (target && typeof target.result === 'string') {
          const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
          resolve({ name: nameWithoutExt, content: target.result });
        } else {
          reject(new Error(`Failed to read file: ${file.name}`));
        }
      };
      reader.onerror = () =>
        reject(new Error(`Error reading file: ${file.name}`));
      reader.readAsText(file);
    });
  };

  const processFiles = async (files: FileList | File[]) => {
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;

      try {
        const { name, content } = await handleFileRead(file);
        const result = await api.saveManifest({
          name,
          content,
          cluster_context: activeContext || 'default',
          folder_id: currentFolderId,
        });

        if (result.success) {
          successCount++;
        } else {
          failCount++;
          errors.push(`${file.name}: ${result.error || 'Save failed'}`);
        }
      } catch (err: unknown) {
        failCount++;
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    if (successCount > 0) {
      toast.success(
        `Successfully imported ${successCount} manifest${successCount > 1 ? 's' : ''}`
      );
      await fetchManifests();
    }

    if (failCount > 0) {
      toast.error(
        `Failed to import ${failCount} file${failCount > 1 ? 's' : ''}: ${errors.join(', ')}`
      );
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const filesArray = Array.from(files);
      e.target.value = '';
      await processFiles(filesArray);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(Array.from(files));
    }
  };

  const handleDeleteClick = (id: number) => {
    setDeleteConfirmationId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmationId) return;
    const id = deleteConfirmationId;
    setDeleteConfirmationId(null);
    const result = await api.deleteManifest(id);
    if (result.success) {
      toast.success('Manifest deleted successfully');
      fetchManifests();
    } else {
      toast.error('Failed to delete manifest');
    }
  };

  const handleApply = async (id: number) => {
    setApplying(id);
    const result = await api.applyManifest(id);
    if (result.success) {
      toast.success('Manifest applied successfully!');
    } else {
      toast.error(`Error applying manifest: ${result.error}`);
    }
    setApplying(null);
  };

  const handleFolderNameSubmit = (name: string) => {
    if (folderNameModal?.mode === 'rename') {
      renameFolder(folderNameModal.folder.id, name);
    } else {
      createFolder(name);
    }
  };

  const handleMove = (targetFolderId: number | null) => {
    if (!moveTarget) return;
    if (moveTarget.kind === 'manifest') {
      moveManifestToFolder(moveTarget.manifest.id, targetFolderId);
    } else {
      moveFolder(moveTarget.folder.id, targetFolderId);
    }
  };

  const moveModalProps = useMemo(() => {
    if (!moveTarget) return null;
    if (moveTarget.kind === 'manifest') {
      return {
        itemName: moveTarget.manifest.name,
        disabledIds: undefined,
        currentLocationId: moveTarget.manifest.folder_id ?? null,
      };
    }
    return {
      itemName: moveTarget.folder.name,
      disabledIds: getSubtreeIds(moveTarget.folder.id),
      currentLocationId: moveTarget.folder.parent_id,
    };
  }, [moveTarget, getSubtreeIds]);

  const isEmpty = visibleManifests.length === 0 && childFolders.length === 0;

  return (
    <div className="manifests-page">
      <div className="page-header">
        <div className="header-title-container">
          <FileCode size={32} className="header-icon" />
          <div className="header-text">
            <h1>Manifest Manager</h1>
            <p>Develop, store, and deploy Kubernetes YAMLs with ease.</p>
          </div>
        </div>
        <div className="header-actions">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".yaml,.yml"
            multiple
            onChange={handleFileUpload}
          />
          <button
            className="btn btn--secondary btn--md upload-btn"
            onClick={() => setFolderNameModal({ mode: 'create' })}
          >
            <FolderPlus size={18} />
            <span>New Folder</span>
          </button>
          <button
            className="btn btn--secondary btn--md upload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={18} />
            <span>Upload YAML</span>
          </button>
          <button
            className="btn btn--secondary btn--md upload-btn"
            onClick={() => setIsExamplesOpen(true)}
          >
            <BookOpen size={18} />
            <span>Examples</span>
          </button>
          <button
            className="btn btn--primary btn--md add-btn"
            onClick={handleAddNew}
          >
            <Plus size={18} />
            <span>New Manifest</span>
          </button>
        </div>
      </div>

      <FolderBreadcrumbs
        breadcrumbs={breadcrumbs}
        onNavigate={openFolder}
        onDropManifest={(manifestId, targetFolderId) =>
          moveManifestToFolder(manifestId, targetFolderId)
        }
        onDropFolder={(folderId, targetFolderId) =>
          moveFolder(folderId, targetFolderId)
        }
      />

      {/* Create / Edit Manifest Modal */}
      <BaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Manifest' : 'Create New Manifest'}
        icon={editingId ? <Edit2 size={20} /> : <Plus size={20} />}
        maxWidth="800px"
        footer={
          <>
            <button
              className="close-footer-button"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn--primary btn--md add-btn"
              onClick={handleSave}
              disabled={!formData.name || !formData.content}
            >
              <Save size={18} />
              <span>{editingId ? 'Update' : 'Save'} Manifest</span>
            </button>
          </>
        }
      >
        <div className="manifest-form">
          <div className="form-group">
            <label htmlFor="manifest-name">Name</label>
            <input
              id="manifest-name"
              type="text"
              autoFocus={focusField === 'name'}
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Nginx Deployment"
            />
          </div>
          <div className="form-group">
            <label htmlFor="manifest-content">YAML Configuration</label>
            <div className="textarea-wrapper">
              <textarea
                id="manifest-content"
                autoFocus={focusField === 'content'}
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                placeholder={`apiVersion: v1\nkind: Service\nmetadata:\n  name: my-service`}
                rows={12}
              />
            </div>
          </div>
        </div>
      </BaseModal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirmationId}
        onClose={() => setDeleteConfirmationId(null)}
        onConfirm={confirmDelete}
        title="Delete Manifest"
        message="Are you sure you want to delete this manifest? This action cannot be undone."
        confirmLabel="Delete Manifest"
        variant="danger"
      />

      {/* Example templates picker */}
      {isExamplesOpen && (
        <ExampleTemplatesModal
          onClose={() => setIsExamplesOpen(false)}
          onSelect={handleExampleSelect}
        />
      )}

      {/* Folder create / rename */}
      {folderNameModal && (
        <FolderNameModal
          onClose={() => setFolderNameModal(null)}
          initialName={
            folderNameModal.mode === 'rename' ? folderNameModal.folder.name : ''
          }
          onSubmit={handleFolderNameSubmit}
        />
      )}

      {/* Folder delete */}
      {deleteFolderTarget && (
        <DeleteFolderModal
          folder={deleteFolderTarget}
          onClose={() => setDeleteFolderTarget(null)}
          onConfirm={(id, mode) => deleteFolder(id, mode)}
        />
      )}

      {/* Move manifest / folder */}
      {moveModalProps && (
        <MoveToFolderModal
          onClose={() => setMoveTarget(null)}
          itemName={moveModalProps.itemName}
          folders={folders}
          disabledIds={moveModalProps.disabledIds}
          currentLocationId={moveModalProps.currentLocationId}
          onMove={handleMove}
        />
      )}

      <div
        className={`manifests-grid-container ${isDragging ? 'is-dragging' : ''}`}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {childFolders.length > 0 && (
          <div className="folders-grid">
            {childFolders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                itemCount={folderItemCounts.get(folder.id) ?? 0}
                onOpen={openFolder}
                onRename={(f) =>
                  setFolderNameModal({ mode: 'rename', folder: f })
                }
                onMove={(f) => setMoveTarget({ kind: 'folder', folder: f })}
                onDelete={setDeleteFolderTarget}
                onDropManifest={(manifestId, targetFolderId) =>
                  moveManifestToFolder(manifestId, targetFolderId)
                }
                onDropFolder={(folderId, targetFolderId) =>
                  moveFolder(folderId, targetFolderId)
                }
              />
            ))}
          </div>
        )}
        <div className="manifests-grid">
          {loading && manifests.length === 0 ? (
            <p>Loading manifests...</p>
          ) : isEmpty ? (
            <div
              className="empty-state drop-zone"
              onClick={() => fileInputRef.current?.click()}
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
            visibleManifests.map((m) => (
              <ManifestCard
                key={m.id}
                manifest={m}
                applying={applying}
                onApply={handleApply}
                onEdit={handleEdit}
                onMove={(manifest) =>
                  setMoveTarget({ kind: 'manifest', manifest })
                }
                onDelete={handleDeleteClick}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Manifests;
