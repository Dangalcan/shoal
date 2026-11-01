import { describe, it, expect, beforeEach } from 'vitest';
import type { ChangeEvent, ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ApiProvider } from '../../../services/api-context';
import {
  ClusterProvider,
  useClusterContext,
} from '../../../features/clusters/ClusterContext';
import { createMockElectronAPI } from '../../utils/mocks';
import { useManifestsPage } from '../../../features/manifests/useManifestsPage';
import type { Manifest, ManifestFolder } from '../../../types.d';

/**
 * The Manifests page hook: the context new manifests are stored under, how a
 * failed or empty library load reads, and the per-folder item counts.
 */

function makeFolder(overrides: Partial<ManifestFolder>): ManifestFolder {
  return {
    id: 1,
    name: 'folder',
    parent_id: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

function makeManifest(overrides: Partial<Manifest>): Manifest {
  return {
    id: 1,
    name: 'manifest',
    content: 'kind: Pod',
    cluster_context: 'kind-dev',
    folder_id: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

describe('useManifestsPage', () => {
  let api: ReturnType<typeof createMockElectronAPI>;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider api={api}>
      <ClusterProvider>{children}</ClusterProvider>
    </ApiProvider>
  );
  const renderPage = () => renderHook(() => useManifestsPage(), { wrapper });

  beforeEach(() => {
    api = createMockElectronAPI();
  });

  it('stores a new manifest under "default" when no context is active', async () => {
    api.getCurrentContext.mockResolvedValue({
      success: false,
      error: 'kubectl not found',
    });
    const { result } = renderPage();
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.editor.create());
    act(() =>
      result.current.editor.setForm({ name: 'web', content: 'kind: Pod' })
    );
    await act(() => result.current.editor.save());

    expect(api.saveManifest).toHaveBeenCalledWith({
      id: undefined,
      name: 'web',
      content: 'kind: Pod',
      cluster_context: 'default',
      folder_id: null,
    });
  });

  it('imports files under "default" when no context is active', async () => {
    api.getCurrentContext.mockResolvedValue({ success: true, data: '' });
    const { result } = renderPage();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() =>
      result.current.importer.handleFileUpload({
        target: { files: [new File(['kind: Job'], 'batch.yaml')], value: '' },
      } as unknown as ChangeEvent<HTMLInputElement>)
    );

    await waitFor(() =>
      expect(api.saveManifest).toHaveBeenCalledWith({
        name: 'batch',
        content: 'kind: Job',
        cluster_context: 'default',
        folder_id: null,
      })
    );
  });

  it('stores new manifests under the active context', async () => {
    api.getCurrentContext.mockResolvedValue({
      success: true,
      data: 'kind-dev',
    });
    const { result } = renderPage();
    await waitFor(() => expect(api.getCurrentContext).toHaveBeenCalled());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.editor.create());
    act(() =>
      result.current.editor.setForm({ name: 'web', content: 'kind: Pod' })
    );
    await act(() => result.current.editor.save());

    expect(api.saveManifest).toHaveBeenCalledWith(
      expect.objectContaining({ cluster_context: 'kind-dev' })
    );
  });

  /** The page hook beside the app-wide cluster state it reads. */
  const renderWithClusters = () =>
    renderHook(
      () => ({ page: useManifestsPage(), clusters: useClusterContext() }),
      { wrapper }
    );

  it('saves under the context the app already knows, without waiting for a read of its own', async () => {
    // The first read answers; every later one hangs, like kubectl busy
    // behind other calls. A page that read the context itself would still
    // be waiting when the user saves, and store the manifest as "default".
    api.getCurrentContext
      .mockResolvedValueOnce({ success: true, data: 'kind-dev' })
      .mockReturnValue(new Promise(() => {}));
    const { result } = renderWithClusters();
    await waitFor(() =>
      expect(result.current.clusters.currentContext).toBe('kind-dev')
    );

    act(() => result.current.page.editor.create());
    act(() =>
      result.current.page.editor.setForm({ name: 'web', content: 'kind: Pod' })
    );
    await act(() => result.current.page.editor.save());

    expect(api.saveManifest).toHaveBeenCalledWith(
      expect.objectContaining({ cluster_context: 'kind-dev' })
    );
  });

  it('stores manifests saved after a context switch under the new context', async () => {
    api.getCurrentContext.mockResolvedValue({
      success: true,
      data: 'kind-dev',
    });
    const { result } = renderWithClusters();
    await waitFor(() =>
      expect(result.current.clusters.currentContext).toBe('kind-dev')
    );

    await act(async () => {
      await result.current.clusters.switchContext('kind-prod');
    });
    expect(result.current.clusters.currentContext).toBe('kind-prod');

    act(() => result.current.page.editor.create());
    act(() =>
      result.current.page.editor.setForm({ name: 'api', content: 'kind: Pod' })
    );
    await act(() => result.current.page.editor.save());

    expect(api.saveManifest).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'api', cluster_context: 'kind-prod' })
    );
  });

  it('gives a generic reason when the library load fails without one', async () => {
    api.getManifests.mockResolvedValue({ success: false } as never);
    const { result } = renderPage();

    await waitFor(() =>
      expect(result.current.loadError).toBe('Failed to fetch manifests')
    );
    expect(result.current.manifests).toEqual([]);
  });

  it('treats a load with no rows as an empty library', async () => {
    api.getManifests.mockResolvedValue({ success: true, data: null } as never);
    const { result } = renderPage();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBeNull();
    expect(result.current.manifests).toEqual([]);
    expect(result.current.isEmpty).toBe(true);
  });

  it('counts subfolders and manifests inside each folder', async () => {
    api.getManifestFolders.mockResolvedValue({
      success: true,
      data: [
        makeFolder({ id: 1, name: 'infra' }),
        makeFolder({ id: 2, name: 'nginx', parent_id: 1 }),
        makeFolder({ id: 3, name: 'certs', parent_id: 1 }),
        makeFolder({ id: 4, name: 'apps' }),
      ],
    });
    api.getManifests.mockResolvedValue({
      success: true,
      data: [
        makeManifest({ id: 10, folder_id: 2 }),
        makeManifest({ id: 11, folder_id: 2 }),
        makeManifest({ id: 12, folder_id: null }),
      ],
    });
    const { result } = renderPage();

    await waitFor(() => expect(result.current.folders.folders).toHaveLength(4));
    await waitFor(() => expect(result.current.manifests).toHaveLength(3));
    expect(Object.fromEntries(result.current.folderItemCounts)).toEqual({
      1: 2,
      2: 2,
    });
    expect(result.current.visibleManifests.map((m) => m.id)).toEqual([12]);
  });
});
