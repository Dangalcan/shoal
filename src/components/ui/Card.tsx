import React from 'react';
import { cn } from '../../lib/utils';


interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  headerAction?: React.ReactNode;
  icon?: React.ReactNode;
}

export function Card({ children, className, title, headerAction, icon }: CardProps) {
  return (
    <div className={cn('ui-card', className)}>
      {(title || headerAction || icon) && (
        <div className="ui-card-header">
          <div className="flex items-center gap-2">
            {icon && <span className="text-slate-400">{icon}</span>}
            {title && <h3 className="ui-card-title">{title}</h3>}
          </div>
          {headerAction}
        </div>
      )}
      <div className="ui-card-content">
        {children}
      </div>
    </div>
  );
}
