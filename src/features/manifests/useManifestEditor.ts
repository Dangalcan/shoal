import { useState } from 'react';
import { toast } from 'sonner';
import type { Manifest } from '../../types.d';
import type { ExampleTemplate } from './example-templates';
import type { Result } from '../../types/result';

export interface ManifestForm {
  name: string;
  content: string;
}

export interface UseManifestEditorOptions {
  /** Stores the form; `editingId` is null for a new manifest. */
  save: (
    editingId: number | null,
    form: ManifestForm
  ) => Promise<Result<unknown>>;
  /** Called after a successful save. */
  onSaved: () => void | Promise<void>;
}

export interface UseManifestEditorResult {
  isOpen: boolean;
  /** Id of the manifest being edited; null when creating one. */
  editingId: number | null;
  form: ManifestForm;
  /** Field focused when the editor opens. */
  focusField: 'name' | 'content';
  setForm: (form: ManifestForm) => void;
  /** Opens an empty editor. */
  create: () => void;
  edit: (manifest: Manifest) => void;
  /** Opens the editor on a copy of an example template. */
  useTemplate: (template: ExampleTemplate) => void;
  close: () => void;
  save: () => Promise<void>;
}

const EMPTY_FORM: ManifestForm = { name: '', content: '' };

/** The create / edit manifest editor: its form, what it edits and saving. */
export function useManifestEditor({
  save,
  onSaved,
}: UseManifestEditorOptions): UseManifestEditorResult {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ManifestForm>(EMPTY_FORM);
  // Uses autoFocus on mount: a delayed focus() call could fire after the
  // user (or a slow machine) had already moved to the other field and steal
  // the typing.
  const [focusField, setFocusField] = useState<'name' | 'content'>('name');

  const open = (
    nextForm: ManifestForm,
    id: number | null,
    field: 'name' | 'content'
  ) => {
    setForm(nextForm);
    setEditingId(id);
    setFocusField(field);
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.content) return;

    const result = await save(editingId, form);

    if (result.success) {
      toast.success(
        editingId
          ? 'Manifest updated successfully'
          : 'Manifest saved successfully'
      );
      setForm(EMPTY_FORM);
      setEditingId(null);
      setIsOpen(false);
      await onSaved();
    } else {
      toast.error('Failed to save manifest');
    }
  };

  return {
    isOpen,
    editingId,
    form,
    focusField,
    setForm,
    create: () => open(EMPTY_FORM, null, 'name'),
    edit: (manifest) =>
      open(
        { name: manifest.name, content: manifest.content },
        manifest.id,
        'content'
      ),
    useTemplate: (template) =>
      open({ name: template.name, content: template.content }, null, 'content'),
    close: () => setIsOpen(false),
    save: handleSave,
  };
}
