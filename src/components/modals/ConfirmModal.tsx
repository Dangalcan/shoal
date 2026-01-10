import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { BaseModal } from './BaseModal';
import '../../../styles/components/modals/ConfirmModal.css';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading,
}: ConfirmModalProps) {
  const variantMap = {
    danger: { iconColor: 'text-red-500', bgClass: 'confirm-bg-red', btnVariant: 'destructive' as const },
    warning: { iconColor: 'text-amber-500', bgClass: 'confirm-bg-amber', btnVariant: 'primary' as const },
    info: { iconColor: 'text-blue-500', bgClass: 'confirm-bg-blue', btnVariant: 'primary' as const },
  };

  const { iconColor, bgClass, btnVariant } = variantMap[variant];

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="">
      <div className="confirm-modal-body">
        <div className="confirm-modal-header">
          <div className={`confirm-modal-icon-wrapper ${bgClass}`}>
            <AlertTriangle className={iconColor} size={24} />
          </div>
          <div className="confirm-modal-content">
            <h3 className="confirm-modal-title">{title}</h3>
            <p className="confirm-modal-message">{message}</p>
          </div>
        </div>

        <div className="confirm-modal-footer">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button 
            variant={btnVariant} 
            onClick={onConfirm} 
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </BaseModal>
  );
}
