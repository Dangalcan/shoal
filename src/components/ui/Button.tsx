import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import '../../../styles/components/ui/Button.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'ui-btn',
          `ui-btn-${variant}`,
          `ui-btn-${size}`,
          className
        )}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" size={size === 'sm' ? 14 : 18} /> : icon}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
