import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useManifestFolders } from '../../../features/manifests/useManifestFolders';
import { useApi } from '../../../services/api-context';
import { createMockElectronAPI } from '../../utils/mocks';
import type { ManifestFolder } from '../../../types.d';

vi.mock('../../../services/api-context', () => ({
  useApi: vi.fn(),
}));

vi.mock('../../../lib/async-operation-handler', () => ({
  handleAsyncOperation: vi.fn(
    async (
      operation: () => Promise<{ success: boolean }>,
      options: { onSuccess?: () => void | Promise<void> }
    ) => {
      const result = await operation();
      if (result.success && options.onSuccess) await options.onSuccess();
      return result;
    }
  ),
}));

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

describe('useManifestFolders', () => {
  const folders = [
    makeFolder({ id: 1, name: 'infra' }),
    makeFolder({ id: 2, name: 'apps' }),
    makeFolder({ id: 3, name: 'nginx', parent_id: 1 }),
    makeFolder({ id: 4, name: 'certs', parent_id: 3 }),
  ];
  let mockApi: ReturnType<typeof createMockElectronAPI>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockElectronAPI({
      getManifestFolders: vi
        .fn()
        .mockResolvedValue({ success: true, data: folders }),
    });
    vi.mocked(useApi).mockReturnValue(mockApi);
  });

  it('loads folders and lists root children by default', async () => {
    const { result } = renderHook(() => useManifestFolders());

    await waitFor(() => expect(result.current.folders).toHaveLength(4));
    expect(result.current.currentFolderId).toBeNull();
    expect(result.current.childFolders.map((f) => f.id)).toEqual([1, 2]);
    expect(result.current.breadcrumbs).toEqual([]);
  });

  it('navigates into a folder and computes breadcrumbs', async () => {
    const { result } = renderHook(() => useManifestFolders());
    await waitFor(() => expect(result.current.folders).toHaveLength(4));

    act(() => result.current.openFolder(3));

    expect(result.current.currentFolder?.name).toBe('nginx');
    expect(result.current.breadcrumbs.map((f) => f.name)).toEqual([
      'infra',
      'nginx',
    ]);
    expect(result.current.childFolders.map((f) => f.id)).toEqual([4]);
  });

  it('creates folders inside the current folder', async () => {
    const { result } = renderHook(() => useManifestFolders());
    await waitFor(() => expect(result.current.folders).toHaveLength(4));

    act(() => result.current.openFolder(1));
    await act(async () => {
      await result.current.createFolder('new-folder');
    });

    expect(mockApi.saveManifestFolder).toHaveBeenCalledWith({
      name: 'new-folder',
      parent_id: 1,
    });
  });

  it('computes subtree ids for a folder', async () => {
    const { result } = renderHook(() => useManifestFolders());
    await waitFor(() => expect(result.current.folders).toHaveLength(4));

    expect([...result.current.getSubtreeIds(1)].sort()).toEqual([1, 3, 4]);
    expect([...result.current.getSubtreeIds(2)]).toEqual([2]);
  });

  it('falls back to the root when the current folder disappears', async () => {
    const { result } = renderHook(() => useManifestFolders());
    await waitFor(() => expect(result.current.folders).toHaveLength(4));

    act(() => result.current.openFolder(2));
    expect(result.current.currentFolderId).toBe(2);

    // Folder 2 vanishes on the next refetch (deleted in another window).
    vi.mocked(mockApi.getManifestFolders).mockResolvedValue({
      success: true,
      data: folders.filter((f) => f.id !== 2),
    });
    await act(async () => {
      await result.current.deleteFolder(2, 'move-to-parent');
    });

    await waitFor(() => expect(result.current.currentFolderId).toBeNull());
  });

  it('notifies onManifestsChanged after moving a manifest', async () => {
    const onManifestsChanged = vi.fn();
    const { result } = renderHook(() =>
      useManifestFolders({ onManifestsChanged })
    );
    await waitFor(() => expect(result.current.folders).toHaveLength(4));

    await act(async () => {
      await result.current.moveManifestToFolder(10, 1);
    });

    expect(mockApi.moveManifest).toHaveBeenCalledWith(10, 1);
    expect(onManifestsChanged).toHaveBeenCalled();
  });
});
