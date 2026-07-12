import React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  DisplaySettingsContext,
  useDisplaySettings,
  type DisplaySettingsContextType,
} from '../../../features/clusters/DisplaySettingsContext';

describe('useDisplaySettings', () => {
  it('throws when used outside a provider', () => {
    expect(() => renderHook(() => useDisplaySettings())).toThrow(
      /must be used within DisplaySettingsContext.Provider/
    );
  });

  it('returns the context value when inside a provider', () => {
    const value: DisplaySettingsContextType = {
      isSettingsOpen: false,
      toggleSettings: () => {},
      closeSettings: () => {},
      visibleResources: [],
      toggleResource: () => {},
      activeTab: 'pods' as DisplaySettingsContextType['activeTab'],
      visibleColumns: [],
      toggleColumn: () => {},
    };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DisplaySettingsContext.Provider value={value}>
        {children}
      </DisplaySettingsContext.Provider>
    );
    const { result } = renderHook(() => useDisplaySettings(), { wrapper });
    expect(result.current).toBe(value);
  });
});
