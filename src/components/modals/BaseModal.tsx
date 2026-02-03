import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import '../../../styles/components/modals/BaseModal.css';

/**
 * Props for the BaseModal component.
 */
export interface BaseModalProps {
  /** Whether the modal is currently visible */
  isOpen: boolean;
  /** Callback function to handle closing the modal (e.g., state updater) */
  onClose: () => void;
  /** Main title displayed in the modal header */
  title: string;
  /** Optional subtitle text displayed below the title */
  subtitle?: string;
  /** Optional icon component to display next to the title */
  icon?: React.ReactNode;
  /** Optional elements to display in the header action area (e.g., buttons) */
  headerActions?: React.ReactNode;
  /** Optional elements to display in the footer */
  footer?: React.ReactNode;
  /** Custom CSS class name for the modal container */
  className?: string;
  /** Modal content */
  children: React.ReactNode;
  /** specific width for the modal */
  width?: string | number;
  /** specific max-width for the modal */
  maxWidth?: string | number;
  /** Allow for data attributes and other props */
  [key: string]: any;
}

/**
 * A reusable modal component with consistent styling and behavior.
 * Handles backdrop clicks and Escape key press for closing.
 *
 * @example
 * <BaseModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="My Modal"
 * >
 *   <p>Modal content</p>
 * </BaseModal>
 */
export function BaseModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  headerActions,
  footer,
  className = '',
  children,
  width,
  maxWidth,
  ...props
}: BaseModalProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  const style = {
    ...(width ? { width } : {}),
    ...(maxWidth ? { maxWidth } : {}),
  };

  return (
    <div className="base-modal-overlay" onClick={handleBackdropClick}>
      <div
        className={`base-modal-container ${className}`}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        {...props}
      >
        {/* Header */}
        <div className="base-modal-header">
          <div className="base-modal-header-content">
            {icon && <div className="base-modal-header-icon">{icon}</div>}
            <div>
              <h3 className="base-modal-title">{title}</h3>
              {subtitle && <p className="base-modal-subtitle">{subtitle}</p>}
            </div>
          </div>

          <div className="base-modal-header-actions">
            {headerActions}
            <button
              onClick={onClose}
              className="base-modal-close-button"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="base-modal-content">{children}</div>

        {/* Footer */}
        {footer && <div className="base-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
