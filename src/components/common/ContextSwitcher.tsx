import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
import { useClusterContext } from '../../features/clusters/ClusterContext';

export function ContextSwitcher() {
  const { clusters, currentContext, switching, switchContext } =
    useClusterContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSwitch = async (contextName: string) => {
    if (contextName === currentContext) {
      setIsOpen(false);
      return;
    }

    await switchContext(contextName);
    setIsOpen(false);
  };

  const displayName = currentContext || 'No Context';
  const isSwitching = switching !== null;

  return (
    <div className="context-switcher" ref={dropdownRef}>
      <button
        className="context-switcher__trigger"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        title="Switch the active context (runs kubectl config use-context, so your terminal switches too)"
      >
        <span className="context-switcher__label">Context:</span>
        <span className="context-switcher__current">{displayName}</span>
        {isSwitching ? (
          <Loader2
            size={16}
            className="context-switcher__icon context-switcher__icon--spinning"
          />
        ) : (
          <ChevronDown
            size={16}
            className={`context-switcher__icon ${isOpen ? 'context-switcher__icon--rotated' : ''}`}
          />
        )}
      </button>

      {isOpen && (
        <div className="context-switcher__dropdown">
          <div className="context-switcher__header">
            <span>Available Contexts</span>
          </div>
          <div className="context-switcher__list">
            {clusters.length > 0 ? (
              clusters.map((cluster) => {
                const isActive = cluster === currentContext;
                const isLoading = switching === cluster;

                return (
                  <button
                    key={cluster}
                    className={`context-switcher__item ${isActive ? 'context-switcher__item--active' : ''}`}
                    onClick={() => handleSwitch(cluster)}
                    disabled={isLoading}
                  >
                    <span className="context-switcher__item-name">
                      {cluster}
                    </span>
                    {isLoading ? (
                      <Loader2
                        size={16}
                        className="context-switcher__item-icon context-switcher__item-icon--spinning"
                      />
                    ) : isActive ? (
                      <Check
                        size={16}
                        className="context-switcher__item-icon"
                      />
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="context-switcher__empty">
                No contexts available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
