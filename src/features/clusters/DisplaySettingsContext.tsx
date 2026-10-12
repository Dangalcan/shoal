import { createContext, useContext } from 'react';
import type { ResourceType } from '../../lib/resources/resource-definitions';

export interface DisplaySettingsContextType {
  isSettingsOpen: boolean;
  toggleSettings: () => void;
  closeSettings: () => void;
  visibleResources: ResourceType[];
  toggleResource: (id: ResourceType) => void;
  activeTab: ResourceType;
  visibleColumns: string[];
  toggleColumn: (id: string) => void;
}

export const DisplaySettingsContext =
  createContext<DisplaySettingsContextType | null>(null);

export function useDisplaySettings(): DisplaySettingsContextType {
  const ctx = useContext(DisplaySettingsContext);
  if (!ctx)
    throw new Error(
      'useDisplaySettings must be used within DisplaySettingsContext.Provider'
    );
  return ctx;
}
