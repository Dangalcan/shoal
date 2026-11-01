import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClusterTabs } from '../../../features/clusters/useClusterTabs';

/**
 * The resource tabs of a cluster: the stored tab is shown while it is
 * visible, the first visible tab otherwise, and hiding the active tab
 * stores that fallback.
 */
describe('useClusterTabs', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts on pods with the default kinds visible', () => {
    const { result } = renderHook(() => useClusterTabs('kind-dev'));

    expect(result.current.activeTab).toBe('pods');
    expect(result.current.tabs.map((t) => t.id)).toEqual(
      result.current.visibleResources
    );
    expect(result.current.visibleResources).toContain('deployments');
  });

  it('remembers the active tab per cluster', () => {
    const { result } = renderHook(() => useClusterTabs('kind-dev'));

    act(() => result.current.setActiveTab('deployments'));

    expect(result.current.activeTab).toBe('deployments');
    expect(
      JSON.parse(window.localStorage.getItem('cluster-tab-kind-dev')!)
    ).toBe('deployments');
    const { result: other } = renderHook(() => useClusterTabs('kind-other'));
    expect(other.current.activeTab).toBe('pods');
  });

  it('shows the first visible tab when the stored one is hidden or unknown', () => {
    window.localStorage.setItem('cluster-tab-kind-dev', JSON.stringify('nope'));
    const { result } = renderHook(() => useClusterTabs('kind-dev'));
    expect(result.current.activeTab).toBe('pods');

    window.localStorage.setItem(
      'k8s_desktop_visible_resources',
      JSON.stringify(['services', 'nodes'])
    );
    window.localStorage.setItem(
      'cluster-tab-kind-dev',
      JSON.stringify('deployments')
    );
    const { result: hidden } = renderHook(() => useClusterTabs('kind-dev'));
    expect(hidden.current.activeTab).toBe('services');
    expect(hidden.current.tabs.map((t) => t.id)).toEqual(['services', 'nodes']);
  });

  it('ignores a stored kind that is no longer a tab', () => {
    // Bindings used to be a tab (kubectl cannot list it); a profile that had
    // it visible and active must land on a real tab.
    window.localStorage.setItem(
      'k8s_desktop_visible_resources',
      JSON.stringify(['bindings', 'services'])
    );
    window.localStorage.setItem(
      'cluster-tab-kind-dev',
      JSON.stringify('bindings')
    );
    const { result } = renderHook(() => useClusterTabs('kind-dev'));

    expect(result.current.activeTab).toBe('services');
    expect(result.current.visibleResources).toEqual(['services']);
    expect(result.current.tabs.map((t) => t.id)).toEqual(['services']);
  });

  it('falls back to pods when nothing is visible', () => {
    window.localStorage.setItem('k8s_desktop_visible_resources', '[]');
    const { result } = renderHook(() => useClusterTabs('kind-dev'));

    expect(result.current.activeTab).toBe('pods');
    expect(result.current.tabs).toEqual([]);
  });

  it('moves to the next visible tab, and stores it, when the active one is hidden', () => {
    const { result } = renderHook(() => useClusterTabs('kind-dev'));
    const next = result.current.visibleResources[1];

    act(() => result.current.toggleResource('pods'));

    expect(result.current.visibleResources).not.toContain('pods');
    expect(result.current.activeTab).toBe(next);
    expect(
      JSON.parse(window.localStorage.getItem('cluster-tab-kind-dev')!)
    ).toBe(next);

    // Showing pods again does not move the view back.
    act(() => result.current.toggleResource('pods'));
    expect(result.current.visibleResources).toContain('pods');
    expect(result.current.activeTab).toBe(next);
  });
});
