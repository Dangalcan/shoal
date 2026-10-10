import type { ReactNode } from 'react';
import { AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ToolMissingPanelProps {
  /** Heading, e.g. "kubectl not found". */
  title: string;
  /** What the tool is needed for and how to fix it. */
  description: ReactNode;
  onOpenInstallDocs: () => void;
  onRecheck: () => void;
  /** Inline banner variant for forms (e.g. Create Cluster). */
  compact?: boolean;
}

/** Shown when a CLI tool Shoal depends on is missing or not usable. */
export function ToolMissingPanel({
  title,
  description,
  onOpenInstallDocs,
  onRecheck,
  compact = false,
}: ToolMissingPanelProps) {
  return (
    <div
      className={cn('tool-missing', compact && 'tool-missing--compact')}
      role="alert"
    >
      <AlertTriangle
        size={compact ? 20 : 40}
        className="tool-missing__icon"
      />
      <p className="tool-missing__title">{title}</p>
      <div className="tool-missing__description">{description}</div>
      <div className="tool-missing__actions">
        <button
          type="button"
          className="tool-missing__secondary-btn"
          onClick={onOpenInstallDocs}
        >
          <Download size={14} />
          Install instructions
        </button>
        <button
          type="button"
          className="tool-missing__primary-btn"
          onClick={onRecheck}
        >
          <RefreshCw size={14} />
          Check again
        </button>
      </div>
    </div>
  );
}
