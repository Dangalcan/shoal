import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createMockElectronAPI } from '../../utils/mocks';
import { mockToast } from '../../mocks/toast-mock';
import { ApiProvider } from '../../../services/api-context';
import { ClusterProvider } from '../../../features/clusters/ClusterContext';
import { useSettings } from '../../../features/settings/useSettings';

/**
 * The Settings page hook: the kubeconfig path round trip through the bridge
 * (with a cluster refresh after a successful save) and the "saved" flash for
 * the localStorage-backed settings.
 */

describe('useSettings', () => {
  let api: ReturnType<typeof createMockElectronAPI>;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider api={api}>
      <ClusterProvider>{children}</ClusterProvider>
    </ApiProvider>
  );

  const renderSettings = () => renderHook(() => useSettings(), { wrapper });

  beforeEach(() => {
    window.localStorage.clear();
    api = createMockElectronAPI({
      getKubeconfigPath: vi.fn().mockResolvedValue({
        success: true,
        data: '/home/ana/.kube/config',
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the saved kubeconfig path', async () => {
    const { result } = renderSettings();

    await waitFor(() =>
      expect(result.current.kubeconfigPath).toBe('/home/ana/.kube/config')
    );
    expect(result.current.defaultNamespace).toBe('');
    expect(result.current.autoRefresh).toBe(true);
    expect(result.current.refreshInterval).toBe(10);
    expect(result.current.localSettingsSaved).toBe(false);
  });

  it('leaves the field empty when the path cannot be read', async () => {
    api.getKubeconfigPath.mockResolvedValue({
      success: false,
      error: 'no settings',
    });
    const { result } = renderSettings();

    await waitFor(() => expect(api.getKubeconfigPath).toHaveBeenCalled());
    expect(result.current.kubeconfigPath).toBe('');
  });

  it('saves the path, confirms it and refreshes the clusters', async () => {
    const { result } = renderSettings();
    await waitFor(() =>
      expect(result.current.kubeconfigPath).toBe('/home/ana/.kube/config')
    );
    api.getClusters.mockClear();

    act(() => result.current.setKubeconfigPath('/tmp/other-kubeconfig'));
    await act(async () => {
      await result.current.handleSaveKubeconfig();
    });

    expect(api.setKubeconfigPath).toHaveBeenCalledWith('/tmp/other-kubeconfig');
    expect(mockToast.success).toHaveBeenCalledWith(
      'Kubeconfig path updated successfully'
    );
    expect(api.getClusters).toHaveBeenCalled();
    expect(result.current.saving).toBe(false);
  });

  it('reports a failed save and stops the spinner', async () => {
    api.setKubeconfigPath.mockResolvedValue({
      success: false,
      error: 'Kubeconfig file not found: /nope',
    });
    const { result } = renderSettings();
    await waitFor(() => expect(api.getKubeconfigPath).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleSaveKubeconfig();
    });

    expect(mockToast.error).toHaveBeenCalledWith(
      'Error updating Kubeconfig: Kubeconfig file not found: /nope'
    );
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(result.current.saving).toBe(false);
  });

  it('flashes the saved indicator for two seconds when a local setting changes', async () => {
    vi.useFakeTimers();
    const { result } = renderSettings();
    await act(async () => {});
    expect(result.current.localSettingsSaved).toBe(false);

    act(() => result.current.setDefaultNamespace('team-a'));
    expect(result.current.defaultNamespace).toBe('team-a');
    expect(result.current.localSettingsSaved).toBe(true);

    // A second change inside the window restarts the timer.
    act(() => vi.advanceTimersByTime(1500));
    act(() => result.current.setRefreshInterval(30));
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.localSettingsSaved).toBe(true);

    act(() => vi.advanceTimersByTime(500));
    expect(result.current.localSettingsSaved).toBe(false);
  });
});
