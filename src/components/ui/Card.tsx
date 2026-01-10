import React from 'react';
import { cn } from '../../lib/utils';
import '../../../styles/components/ui/Card.css';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  headerAction?: React.ReactNode;
}

export function Card({ children, className, title, headerAction }: CardProps) {
  return (
    <div className={cn('ui-card', className)}>
      {(title || headerAction) && (
        <div className="ui-card-header">
          {title && <h3 className="ui-card-title">{title}</h3>}
          {headerAction}
        </div>
      )}
      <div className="ui-card-content">
        {children}
      </div>
    </div>
  );
}
