import { useState, useEffect, useRef } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import { FileCode, Plus, Save, Edit2, Upload, FileUp } from 'lucide-react';
import { toast } from 'sonner';
import { useApi } from '../services/api-context';
import { Manifest } from '../types.d';
import { BaseModal } from '../components/modals/BaseModal';
import { ConfirmModal } from '../components/modals/ConfirmModal';
import { ManifestCard } from '../features/manifests/ManifestCard';

export function Manifests() {
  const api = useApi();
  const { data: manifestsData, loading, refetch: fetchManifests } = useAsyncData<Manifest[]>({
    fetchFn: async () => {
      const result = await api.getManifests();
      if (!result.success) throw new Error('Failed to fetch manifests');
      return result.data ?? [];
    },
    errorTitle: 'Failed to fetch manifests',
  });
  const manifests = manifestsData ?? [];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', content: '' });
  const [applying, setApplying] = useState<number | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<number | null>(null);
  const [activeContext, setActiveContext] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchContext();
  }, []);

  const fetchContext = async () => {
    const result = await api.getCurrentContext();
    if (result.success && result.data) {
      setActiveContext(result.data);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.content) return;

    const result = await api.saveManifest({
      id: editingId || undefined,
      name: formData.name,
      content: formData.content,
      cluster_context: activeContext || 'default'
    });

    if (result.success) {
      toast.success(editingId ? 'Manifest updated successfully' : 'Manifest saved successfully');
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
    setIsModalOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleAddNew = () => {
    setFormData({ name: '', content: '' });
    setEditingId(null);
    setIsModalOpen(true);
    setTimeout(() => {
      const input = document.getElementById('manifest-name');
      input?.focus();
    }, 100);
  };

  const handleFileRead = (file: File): Promise<{name: string, content: string}> => {
    return new Promise((resolve, reject) => {
      if (!file.name.toLowerCase().endsWith('.yaml') && !file.name.toLowerCase().endsWith('.yml')) {
        reject(new Error(`Invalid file type: ${file.name}`));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const target = e.target;
        if (target && typeof target.result === 'string') {
          const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
          resolve({ name: nameWithoutExt, content: target.result });
        } else {
          reject(new Error(`Failed to read file: ${file.name}`));
        }
      };
      reader.onerror = () => reject(new Error(`Error reading file: ${file.name}`));
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
          cluster_context: activeContext || 'default'
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
      toast.success(`Successfully imported ${successCount} manifest${successCount > 1 ? 's' : ''}`);
      await fetchManifests();
    }

    if (failCount > 0) {
      toast.error(`Failed to import ${failCount} file${failCount > 1 ? 's' : ''}: ${errors.join(', ')}`);
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
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
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
          <button className="btn btn--secondary btn--md upload-btn" onClick={() => fileInputRef.current?.click()}>
            <Upload size={18} />
            <span>Upload YAML</span>
          </button>
          <button className="btn btn--primary btn--md add-btn" onClick={handleAddNew}>
            <Plus size={18} />
            <span>New Manifest</span>
          </button>
        </div>
      </div>

      {/* Create / Edit Manifest Modal */}
      <BaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Manifest' : 'Create New Manifest'}
        icon={editingId ? <Edit2 size={20} /> : <Plus size={20} />}
        maxWidth="800px"
        footer={
          <>
            <button className="close-footer-button" onClick={() => setIsModalOpen(false)}>
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
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Nginx Deployment"
            />
          </div>
          <div className="form-group">
            <label htmlFor="manifest-content">YAML Configuration</label>
            <div className="textarea-wrapper">
              <textarea
                id="manifest-content"
                ref={textareaRef}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
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

      <div
        className={`manifests-grid-container ${isDragging ? 'is-dragging' : ''}`}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="manifests-grid">
          {loading && manifests.length === 0 ? (
            <p>Loading manifests...</p>
          ) : manifests.length === 0 ? (
            <div
              className="empty-state drop-zone"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp size={48} className="empty-icon" />
              <p>No saved manifests found.</p>
              <span>Click here to upload or drag & drop your YAML files anywhere.</span>
            </div>
          ) : (
            manifests.map((m) => (
              <ManifestCard
                key={m.id}
                manifest={m}
                applying={applying}
                onApply={handleApply}
                onEdit={handleEdit}
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
