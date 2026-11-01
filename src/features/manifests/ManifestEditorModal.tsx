import { Plus, Save, Edit2 } from 'lucide-react';
import { BaseModal } from '../../components/modals/BaseModal';
import type { UseManifestEditorResult } from './useManifestEditor';

interface ManifestEditorModalProps {
  editor: UseManifestEditorResult;
}

/** The create / edit manifest dialog: a name and the YAML text. */
export function ManifestEditorModal({ editor }: ManifestEditorModalProps) {
  const { form, editingId, focusField } = editor;
  return (
    <BaseModal
      isOpen={editor.isOpen}
      onClose={editor.close}
      title={editingId ? 'Edit Manifest' : 'Create New Manifest'}
      icon={editingId ? <Edit2 size={20} /> : <Plus size={20} />}
      maxWidth="800px"
      footer={
        <>
          <button className="close-footer-button" onClick={editor.close}>
            Cancel
          </button>
          <button
            className="btn btn--primary btn--md add-btn"
            onClick={editor.save}
            disabled={!form.name || !form.content}
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
            value={form.name}
            onChange={(e) => editor.setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Nginx Deployment"
          />
        </div>
        <div className="form-group">
          <label htmlFor="manifest-content">YAML Configuration</label>
          <div className="textarea-wrapper">
            <textarea
              id="manifest-content"
              autoFocus={focusField === 'content'}
              value={form.content}
              onChange={(e) =>
                editor.setForm({ ...form, content: e.target.value })
              }
              placeholder={`apiVersion: v1\nkind: Service\nmetadata:\n  name: my-service`}
              rows={12}
            />
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
