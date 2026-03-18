import { ResourceType } from '../../lib/resources/resource-definitions';


interface Tab {
  id: ResourceType;
  label: string;
  icon: React.ElementType;
}

interface ResourceTabsProps {
  tabs: Tab[];
  activeTab: ResourceType;
  onTabChange: (id: ResourceType) => void;
}

export function ResourceTabs({ tabs, activeTab, onTabChange }: ResourceTabsProps) {
  return (
    <div className="tabs-container">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`tab-button ${activeTab === tab.id ? 'tab-button-active' : 'tab-button-inactive'}`}
        >
          <tab.icon size={16} />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
