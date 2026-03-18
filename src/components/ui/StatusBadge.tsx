import React from 'react';

export type StatusVariant = 'success' | 'warning' | 'error' | 'neutral';

const VARIANT_CLASS: Record<StatusVariant, string> = {
  success: 'status-badge-success',
  warning: 'status-badge-warning',
  error:   'status-badge-error',
  neutral: 'status-badge-other',
};

interface StatusBadgeProps {
  label: string;
  variant: StatusVariant;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, variant }) => (
  <span className={`status-badge ${VARIANT_CLASS[variant]}`}>{label}</span>
);
