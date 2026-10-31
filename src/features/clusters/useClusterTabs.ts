import { useMemo, useCallback } from 'react';
import {
  ResourceType,
  ALL_TABS,
  RESOURCE_CONFIGS,
} from '../../lib/resources/resource-definitions';
import { useLocalStorage } from '../../hooks';

/** Resource kinds shown as tabs until the user changes the selection. */
const DEFAULT_VISIBLE_RESOURCES: ResourceType[] = RESOURCE_CONFIGS.filter(
  (c) => !c.defaultHidden
).map((c) => c.id);

/**
 * The tab shown for a stored choice: the choice itself while it is visible,
 * otherwise the first visible tab (pods when nothing is visible).
 */
function visibleTab(
  stored: ResourceType,
  visible: ResourceType[]
): ResourceType {
  return visible.includes(stored) ? stored : (visible[0] ?? 'pods');
}

/**
 * The resource tabs of a cluster: which kinds are visible and which one is
 * active, both remembered in localStorage (the active tab per cluster). The
 * stored tab may have been hidden since, or not be a resource kind at all:
 * the view shows the first visible tab instead, and hiding the active tab
 * stores that fallback.
 */
export function useClusterTabs(name: string | undefined) {
  const [storedTab, setActiveTab] = useLocalStorage<ResourceType>(
    `cluster-tab-${name}`,
    'pods'
  );
  const [visibleResources, setVisibleResources] = useLocalStorage<
    ResourceType[]
  >('k8s_desktop_visible_resources', DEFAULT_VISIBLE_RESOURCES);
  const activeTab = visibleTab(storedTab, visibleResources);

  const tabs = useMemo(
    () => ALL_TABS.filter((tab) => visibleResources.includes(tab.id)),
    [visibleResources]
  );

  const toggleResource = useCallback(
    (id: ResourceType) => {
      const next = visibleResources.includes(id)
        ? visibleResources.filter((r) => r !== id)
        : [...visibleResources, id];
      setVisibleResources(next);
      if (!next.includes(activeTab)) setActiveTab(visibleTab(activeTab, next));
    },
    [visibleResources, activeTab, setVisibleResources, setActiveTab]
  );

  return { activeTab, setActiveTab, tabs, visibleResources, toggleResource };
}
