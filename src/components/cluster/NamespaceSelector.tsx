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
        {Array.from(new Set(['all', ...namespaces])).map((ns) => (
          <option key={ns} value={ns}>
            {ns === 'all' ? 'All Namespaces' : ns}
          </option>
        ))}
      </select>
    </div>
  );
}
