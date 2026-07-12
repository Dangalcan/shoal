import { BookOpen } from 'lucide-react';
import { BaseModal } from '../../components/modals/BaseModal';
import { EXAMPLE_TEMPLATES, ExampleTemplate } from './example-templates';

/**
 * Rendered only while open (the parent mounts it conditionally).
 * Picking a template hands it to the parent, which pre-fills the
 * create-manifest modal so the user can tweak before saving.
 */
interface ExampleTemplatesModalProps {
  onClose: () => void;
  onSelect: (template: ExampleTemplate) => void;
}

export function ExampleTemplatesModal({ onClose, onSelect }: ExampleTemplatesModalProps) {
  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title="Example Manifests"
      icon={<BookOpen size={20} />}
      maxWidth="640px"
      footer={
        <button className="close-footer-button" onClick={onClose}>
          Cancel
        </button>
      }
    >
      <div className="example-templates">
        {EXAMPLE_TEMPLATES.map((template) => (
          <button
            key={template.id}
            className="example-templates__item"
            onClick={() => {
              onSelect(template);
              onClose();
            }}
          >
            <span className="example-templates__name">{template.name}</span>
            <span className="example-templates__description">{template.description}</span>
          </button>
        ))}
      </div>
    </BaseModal>
  );
}
