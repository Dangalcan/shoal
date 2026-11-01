import { useState, useMemo } from 'react';
import { Settings, X, Search, ChevronDown, ChevronRight } from 'lucide-react';
import {
  ALL_TABS,
  COLUMN_DEFINITIONS,
  ResourceCategory,
} from '../../lib/resources/resource-definitions';
import { useDisplaySettings } from '../../features/clusters/DisplaySettingsContext';

export function SettingsDropdown() {
  const {
    isSettingsOpen,
    toggleSettings,
    closeSettings,
    visibleResources,
    toggleResource,
    activeTab,
    visibleColumns,
    toggleColumn,
  } = useDisplaySettings();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({
    Workloads: true,
    Networking: true,
    Cluster: true,
  });

  const filteredResources = useMemo(() => {
    return ALL_TABS.filter(
      (tab) =>
        tab.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tab.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const resourcesByCategory = useMemo(() => {
    const categories = {} as Record<ResourceCategory, typeof ALL_TABS>;
    filteredResources.forEach((resource) => {
      if (!categories[resource.category]) {
        categories[resource.category] = [];
      }
      categories[resource.category].push(resource);
    });
    return categories;
  }, [filteredResources]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  return (
    <div className="relative">
      <button
        onClick={toggleSettings}
        className={`settings-button ${isSettingsOpen ? 'settings-button-active' : 'settings-button-inactive'}`}
        title="Display Settings"
      >
        <Settings size={18} />
      </button>

      {isSettingsOpen && (
        <div className="settings-dropdown">
          <div className="settings-dropdown-header">
            <span className="settings-dropdown-title">Display Settings</span>
            <button
              onClick={closeSettings}
              className="settings-close-button"
              title="Close Settings"
            >
              <X size={14} />
            </button>
          </div>

          <div className="settings-search-container">
            <Search size={14} className="settings-search-icon" />
            <input
              type="text"
              placeholder="Filter resources..."
              aria-label="Filter resources"
              className="settings-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          <div className="settings-dropdown-content">
            <div className="settings-section-title">Resources</div>
            <div className="settings-section">
              {(Object.keys(resourcesByCategory) as ResourceCategory[])
                .sort()
                .map((category) => {
                  // While filtering, every category with a match is open:
                  // a hit inside a collapsed one would stay out of sight.
                  const expanded =
                    searchQuery !== '' || !!expandedCategories[category];
                  return (
                    <div key={category} className="settings-category-group">
                      <button
                        className="settings-category-header"
                        onClick={() => toggleCategory(category)}
                      >
                        <div className="settings-category-title-container">
                          {expanded ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                          <span className="settings-category-title">
                            {category}
                          </span>
                        </div>
                        <span className="settings-category-count">
                          {
                            resourcesByCategory[category].filter((r) =>
                              visibleResources.includes(r.id)
                            ).length
                          }{' '}
                          / {resourcesByCategory[category].length}
                        </span>
                      </button>

                      {expanded && (
                        <div className="settings-category-items">
                          {resourcesByCategory[category].map((tab) => (
                            <button
                              key={tab.id}
                              onClick={() => toggleResource(tab.id)}
                              className="settings-item-button"
                            >
                              <div className="settings-item-content">
                                <tab.icon
                                  size={14}
                                  className="settings-item-icon"
                                />
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
                              <div
                                className={`settings-toggle ${visibleResources.includes(tab.id) ? 'settings-toggle-on' : 'settings-toggle-off'}`}
                              >
                                <div className="settings-toggle-thumb" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            <div className="settings-section-title settings-divider">
              Columns for {activeTab}
            </div>
            <div className="settings-section">
              {COLUMN_DEFINITIONS[activeTab].map((col) => (
                <button
                  key={col.id}
                  onClick={() => toggleColumn(col.id)}
                  className="settings-item-button"
                >
                  <span
                    className={
                      visibleColumns.includes(col.id)
                        ? 'settings-item-label-active'
                        : 'settings-item-label-inactive'
                    }
                  >
                    {col.label}
                  </span>
                  <div
                    className={`settings-toggle ${visibleColumns.includes(col.id) ? 'settings-toggle-on' : 'settings-toggle-off'}`}
                  >
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
