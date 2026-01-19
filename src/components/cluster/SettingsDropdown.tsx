import { useState, useMemo } from 'react';
import { Settings, X, Check, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { ResourceType, ALL_TABS, COLUMN_DEFINITIONS, ResourceCategory } from '../../lib/resource-definitions';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'Workloads': true,
    'Networking': true,
    'Cluster': true,
  });

  const filteredResources = useMemo(() => {
    return ALL_TABS.filter(tab => 
      tab.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tab.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const resourcesByCategory = useMemo(() => {
    const categories: Record<ResourceCategory, typeof ALL_TABS> = {} as any;
    filteredResources.forEach(resource => {
      if (!categories[resource.category]) {
        categories[resource.category] = [];
      }
      categories[resource.category].push(resource);
    });
    return categories;
  }, [filteredResources]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`settings-button ${isOpen ? 'settings-button-active' : 'settings-button-inactive'}`}
        title="Display Settings"
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
          
          <div className="settings-search-container">
            <Search size={14} className="settings-search-icon" />
            <input
              type="text"
              placeholder="Filter resources..."
              className="settings-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          <div className="settings-dropdown-content">
            <div className="settings-section-title">Resources</div>
            <div className="settings-section">
              {(Object.keys(resourcesByCategory) as ResourceCategory[]).sort().map((category) => (
                <div key={category} className="settings-category-group">
                  <button 
                    className="settings-category-header"
                    onClick={() => toggleCategory(category)}
                  >
                    <div className="settings-category-title-container">
                      {expandedCategories[category] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span className="settings-category-title">{category}</span>
                    </div>
                    <span className="settings-category-count">
                      {resourcesByCategory[category].filter(r => visibleResources.includes(r.id)).length} / {resourcesByCategory[category].length}
                    </span>
                  </button>
                  
                  {expandedCategories[category] && (
                    <div className="settings-category-items">
                      {resourcesByCategory[category].map((tab) => (
                        <button key={tab.id} onClick={() => onToggleResource(tab.id as ResourceType)} className="settings-item-button">
                          <div className="settings-item-content">
                            <tab.icon size={14} className="settings-item-icon" />
                            <span
                              className={
                                visibleResources.includes(tab.id as ResourceType)
                                  ? 'settings-item-label-active'
                                  : 'settings-item-label-inactive'
                              }
                            >
                              {tab.label}
                            </span>
                          </div>
                          <div className={`settings-toggle ${visibleResources.includes(tab.id as ResourceType) ? 'settings-toggle-on' : 'settings-toggle-off'}`}>
                            <div className="settings-toggle-thumb" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                  <div className={`settings-toggle ${visibleColumns.includes(col.id) ? 'settings-toggle-on' : 'settings-toggle-off'}`}>
                    <div className="settings-toggle-thumb" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
