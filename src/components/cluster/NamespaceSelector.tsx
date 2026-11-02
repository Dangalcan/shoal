import { Search } from 'lucide-react';

interface NamespaceSelectorProps {
  namespaces: string[];
  selectedNamespace: string;
  onNamespaceChange: (ns: string) => void;
}

export function NamespaceSelector({
  namespaces,
  selectedNamespace,
  onNamespaceChange,
}: NamespaceSelectorProps) {
  return (
    <div className="namespace-selector-container">
      <Search className="namespace-selector-icon" size={16} />
      <select
        id="namespace-selector"
        aria-label="Namespace Selector"
        value={selectedNamespace}
        onChange={(e) => onNamespaceChange(e.target.value)}
        className="namespace-selector"
      >
        {/* The selected one may not be listed (a Default Namespace that does
            not exist here, a list that failed); without its option the select
            would claim "All Namespaces" over a filtered table. */}
        {Array.from(new Set(['all', selectedNamespace, ...namespaces])).map(
          (ns) => (
            <option key={ns} value={ns}>
              {ns === 'all' ? 'All Namespaces' : ns}
            </option>
          )
        )}
      </select>
    </div>
  );
}
