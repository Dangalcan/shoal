import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'active' | 'available';
  dot?: boolean;
}

export function Badge({
  children,
  variant = 'info',
  className,
  dot,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn('ui-badge', `ui-badge-${variant}`, className)}
      {...props}
    >
      {dot && <span className="ui-badge-dot" />}
      {children}
    </span>
  );
}
