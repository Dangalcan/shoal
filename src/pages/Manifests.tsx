import { useState, useEffect, useRef } from 'react';
import { FileCode, Plus, Trash2, Play, Save, X, Edit2, AlertCircle, CheckCircle2, Upload, FileUp } from 'lucide-react';
import { useApi } from '../services/api-context';
import { Manifest } from '../types.d';
import '../../styles/pages/Manifests.css';

export function Manifests() {
  const api = useApi();
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', content: '' });
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<number | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeContext, setActiveContext] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchManifests();
    fetchContext();
  }, []);

  const fetchContext = async () => {
    const result = await api.getCurrentContext();
    if (result.success && result.data) {
      setActiveContext(result.data);
    }
  };

  const fetchManifests = async () => {
    setLoading(true);
    const result = await api.getManifests();
    if (result.success && result.data) {
      setManifests(result.data);
    } else {
      setError('Failed to fetch manifests');
    }
    setLoading(false);
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
      setSuccess(editingId ? 'Manifest updated successfully' : 'Manifest saved successfully');
      setFormData({ name: '', content: '' });
      setEditingId(null);
      setIsModalOpen(false);
      fetchManifests();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError('Failed to save manifest');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleEdit = (manifest: Manifest) => {
    setFormData({ name: manifest.name, content: manifest.content });
    setEditingId(manifest.id);
    setIsModalOpen(true);
    // Focus textarea after modal opens
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleAddNew = () => {
    setFormData({ name: '', content: '' });
    setEditingId(null);
    setIsModalOpen(true);
    // Focus name input after modal opens
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
          resolve({
            name: nameWithoutExt,
            content: target.result
          });
        } else {
          reject(new Error(`Failed to read file: ${file.name}`));
        }
      };
      reader.onerror = () => reject(new Error(`Error reading file: ${file.name}`));
      reader.readAsText(file);
    });
  };

  const processFiles = async (files: FileList | File[]) => {
    setLoading(true);
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
      } catch (err: any) {
        failCount++;
        errors.push(err.message);
      }
    }

    if (successCount > 0) {
      setSuccess(`Successfully imported ${successCount} manifest${successCount > 1 ? 's' : ''}`);
      await fetchManifests();
      setTimeout(() => setSuccess(null), 3000);
    }

    if (failCount > 0) {
      setError(`Failed to import ${failCount} file${failCount > 1 ? 's' : ''}: ${errors.join(', ')}`);
      setTimeout(() => setError(null), 7000);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const filesArray = Array.from(files);
      // Reset input value immediately after snapshoting so the same files can be uploaded again
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
      const filesArray = Array.from(files);
      processFiles(filesArray);
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
      setSuccess('Manifest deleted successfully');
      fetchManifests();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError('Failed to delete manifest');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleApply = async (id: number) => {
    setApplying(id);
    const result = await api.applyManifest(id);
    if (result.success) {
      setSuccess('Manifest applied successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(`Error applying manifest: ${result.error}`);
      setTimeout(() => setError(null), 5000);
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
          <button className="btn btn-secondary upload-btn" onClick={() => fileInputRef.current?.click()}>
            <Upload size={18} />
            <span>Upload YAML</span>
          </button>
          <button className="btn btn-primary add-btn" onClick={handleAddNew}>
            <Plus size={18} />
            <span>New Manifest</span>
          </button>
        </div>
      </div>

      <div className="alerts-container">
        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="alert alert-success">
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title">
                {editingId ? <Edit2 size={20} /> : <Plus size={20} />}
                <h3>{editingId ? 'Edit Manifest' : 'Create New Manifest'}</h3>
              </div>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="manifest-name">Name</label>
                <input 
                  id="manifest-name"
                  type="text" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
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
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    placeholder="apiVersion: v1
kind: Service
metadata:
  name: my-service"
                    rows={12}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={handleSave}
                disabled={!formData.name || !formData.content}
              >
                <Save size={18} />
                <span>{editingId ? 'Update' : 'Save'} Manifest</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        className={`manifests-grid-container ${isDragging ? 'is-dragging' : ''}`}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {deleteConfirmationId && (
          <div className="modal-overlay" onClick={() => setDeleteConfirmationId(null)}>
            <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-header-title alert-title">
                  <AlertCircle size={20} />
                  <h3>Delete Manifest</h3>
                </div>
                <button className="btn-close" onClick={() => setDeleteConfirmationId(null)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete this manifest? This action cannot be undone.</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setDeleteConfirmationId(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={confirmDelete}>
                  <Trash2 size={18} />
                  <span>Delete Manifest</span>
                </button>
              </div>
            </div>
          </div>
        )}

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
              <div key={m.id} className="manifest-card">
                <div className="card-header">
                  <h3 title={m.name}>{m.name}</h3>
                  <div className="card-actions">
                    <button 
                      className="btn-icon btn-apply" 
                      title="Apply to Cluster"
                      onClick={() => handleApply(m.id)}
                      disabled={applying === m.id}
                    >
                      {applying === m.id ? <div className="spinner-small" /> : <Play size={16} />}
                    </button>
                    <button 
                      className="btn-icon btn-edit" 
                      title="Edit Manifest"
                      onClick={() => handleEdit(m)}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      className="btn-icon btn-delete" 
                      title="Delete"
                      onClick={() => handleDeleteClick(m.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  <div className="manifest-info">
                    <span>Context: {m.cluster_context}</span>
                    <span>Updated: {new Date(m.updated_at).toLocaleDateString()}</span>
                  </div>
                  <pre className="yaml-preview">
                    {m.content.substring(0, 150)}
                    {m.content.length > 150 ? '...' : ''}
                  </pre>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Manifests;
