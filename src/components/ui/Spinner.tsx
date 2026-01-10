import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import '../../../styles/components/ui/Spinner.css';

interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

export function Spinner({ size = 24, className, label }: SpinnerProps) {
  return (
    <div className={cn('ui-spinner-container', className)}>
      <Loader2 className="ui-spinner-icon" size={size} />
      {label && <p className="ui-spinner-label">{label}</p>}
    </div>
  );
}
