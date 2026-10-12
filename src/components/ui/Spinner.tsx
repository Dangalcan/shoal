import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const SIZE_MAP: Record<string, number> = {
  small: 24,
  sm: 24,
  medium: 40,
  md: 40,
  large: 60,
  lg: 60,
};

interface SpinnerProps {
  size?: number | string;
  className?: string;
  label?: string;
}

export function Spinner({ size = 32, className, label }: SpinnerProps) {
  const resolvedSize = typeof size === 'string' ? (SIZE_MAP[size] ?? 24) : size;
  return (
    <div className={cn('ui-spinner-container', className)}>
      <Loader2 className="ui-spinner-icon" size={resolvedSize} />
      {label && <p className="ui-spinner-label">{label}</p>}
    </div>
  );
}
