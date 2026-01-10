import { Settings, X, Check } from 'lucide-react';
import { ResourceType, ALL_TABS, COLUMN_DEFINITIONS } from '../../lib/resource-definitions';
import '../../../styles/components/cluster/SettingsDropdown.css';

interface SettingsDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  visibleResources: ResourceType[];
  onToggleResource: (id: ResourceType) => void;
  activeTab: ResourceType;
  visibleColumns: string[];
  onToggleColumn: (id: string) => void;
}

export function SettingsDropdown({
  isOpen,
  onToggle,
  onClose,
  visibleResources,
  onToggleResource,
  activeTab,
  visibleColumns,
  onToggleColumn,
}: SettingsDropdownProps) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`settings-button ${isOpen ? 'settings-button-active' : 'settings-button-inactive'}`}
        title="Visible Resources"
      >
        <Settings size={18} />
      </button>

      {isOpen && (
        <div className="settings-dropdown">
          <div className="settings-dropdown-header">
            <span className="settings-dropdown-title">Display Settings</span>
            <button onClick={onClose} className="settings-close-button" title="Close Settings">
              <X size={14} />
            </button>
          </div>
          <div className="settings-dropdown-content">
            <div className="settings-section-title">Resources</div>
            <div className="settings-section">
              {ALL_TABS.map((tab) => (
                <button key={tab.id} onClick={() => onToggleResource(tab.id)} className="settings-item-button">
                  <div className="settings-item-content">
                    <tab.icon size={14} className="settings-item-icon" />
                    <span
                      className={
                        visibleResources.includes(tab.id)
                          ? 'settings-item-label-active'
                          : 'settings-item-label-inactive'
                      }
                    >
                      {tab.label}
                    </span>
                  </div>
                  {visibleResources.includes(tab.id) && <Check size={14} className="settings-item-check" />}
                </button>
              ))}
            </div>

            <div className="settings-section-title settings-divider">Columns for {activeTab}</div>
            <div className="settings-section">
              {COLUMN_DEFINITIONS[activeTab].map((col) => (
                <button key={col.id} onClick={() => onToggleColumn(col.id)} className="settings-item-button">
                  <span
                    className={
                      visibleColumns.includes(col.id) ? 'settings-item-label-active' : 'settings-item-label-inactive'
                    }
                  >
                    {col.label}
                  </span>
                  {visibleColumns.includes(col.id) && <Check size={14} className="settings-item-check" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
