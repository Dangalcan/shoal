import React from 'react';
import { cn } from '../../lib/utils';
import '../../../styles/components/ui/Badge.css';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'active' | 'available';
  className?: string;
  dot?: boolean;
}

export function Badge({ children, variant = 'info', className, dot }: BadgeProps) {
  return (
    <span className={cn(
      'ui-badge',
      `ui-badge-${variant}`,
      className
    )}>
      {dot && <span className="ui-badge-dot" />}
      {children}
    </span>
  );
}
