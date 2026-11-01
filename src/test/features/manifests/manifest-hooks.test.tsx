import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ApiProvider } from '../../../services/api-context';
import { createMockElectronAPI } from '../../utils/mocks';
import { mockToast } from '../../mocks/toast-mock';
import { useManifestActions } from '../../../features/manifests/useManifestActions';
import { useManifestEditor } from '../../../features/manifests/useManifestEditor';
import { useManifestFolderDialogs } from '../../../features/manifests/useManifestFolderDialogs';
import { useManifestImport } from '../../../features/manifests/useManifestImport';
import type { UseManifestFoldersResult } from '../../../features/manifests/useManifestFolders';

/**
 * The guard paths of the Manifests page hooks that the page itself never
 * reaches through its own buttons: a confirm with nothing pending, a save
 * with an empty field, a move with no target, an empty file pick or drop,
 * and a store that rejects with a non-Error value.
 */

describe('useManifestActions', () => {
  let api: ReturnType<typeof createMockElectronAPI>;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider api={api}>{children}</ApiProvider>
  );

  beforeEach(() => {
    api = createMockElectronAPI();
  });

  it('does nothing when deletion is confirmed with nothing pending', async () => {
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useManifestActions(onDeleted), {
      wrapper,
    });

    await act(() => result.current.deletion.confirm());

    expect(api.deleteManifest).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it('deletes the pending manifest once and clears the request', async () => {
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useManifestActions(onDeleted), {
      wrapper,
    });

    act(() => result.current.deletion.request(5));
    expect(result.current.deletion.pendingId).toBe(5);
    await act(() => result.current.deletion.confirm());

    expect(api.deleteManifest).toHaveBeenCalledWith(5);
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(result.current.deletion.pendingId).toBeNull();
  });
});

describe('useManifestEditor', () => {
  it.each([
    ['name', { name: '', content: 'kind: Pod' }],
    ['content', { name: 'web', content: '' }],
  ])('does not save while the %s is empty', async (_field, form) => {
    const save = vi.fn();
    const onSaved = vi.fn();
    const { result } = renderHook(() => useManifestEditor({ save, onSaved }));

    act(() => result.current.create());
    act(() => result.current.setForm(form));
    await act(() => result.current.save());

    expect(save).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(result.current.isOpen).toBe(true);
  });
});

describe('useManifestFolderDialogs', () => {
  it('does not move anything when no item was picked', async () => {
    const folders = {
      moveFolder: vi.fn(),
      moveManifestToFolder: vi.fn(),
      getSubtreeIds: vi.fn(),
    } as unknown as UseManifestFoldersResult;
    const { result } = renderHook(() => useManifestFolderDialogs(folders));

    await act(() => result.current.move(3));

    expect(result.current.moveDialog).toBeNull();
    expect(folders.moveFolder).not.toHaveBeenCalled();
    expect(folders.moveManifestToFolder).not.toHaveBeenCalled();
  });
});

describe('useManifestImport', () => {
  const pickEvent = (files: File[] | null) =>
    ({
      target: { files, value: 'picked.yaml' },
    }) as unknown as ChangeEvent<HTMLInputElement>;

  const dropEvent = (files: File[]) =>
    ({
      preventDefault: vi.fn(),
      dataTransfer: { types: ['Files'], files },
    }) as unknown as DragEvent;

  it('ignores a file pick that was cancelled or empty', async () => {
    const saveImported = vi.fn();
    const onImported = vi.fn();
    const { result } = renderHook(() =>
      useManifestImport({ saveImported, onImported })
    );

    await act(() => result.current.handleFileUpload(pickEvent(null)));
    await act(() => result.current.handleFileUpload(pickEvent([])));

    expect(saveImported).not.toHaveBeenCalled();
    expect(onImported).not.toHaveBeenCalled();
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('ends the drag without importing when a file drop carries no files', async () => {
    const saveImported = vi.fn();
    const { result } = renderHook(() =>
      useManifestImport({ saveImported, onImported: vi.fn() })
    );

    act(() => result.current.onDragOver(dropEvent([])));
    expect(result.current.isDragging).toBe(true);
    await act(() => result.current.onDrop(dropEvent([])));

    expect(result.current.isDragging).toBe(false);
    expect(saveImported).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('lists a store failure that is not an Error', async () => {
    const saveImported = vi.fn().mockRejectedValue('database locked');
    const onImported = vi.fn();
    const { result } = renderHook(() =>
      useManifestImport({ saveImported, onImported })
    );

    await act(() =>
      result.current.handleFileUpload(
        pickEvent([new File(['kind: Pod'], 'web.yaml')])
      )
    );

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to import 1 file: database locked'
      )
    );
    expect(saveImported).toHaveBeenCalledWith({
      name: 'web',
      content: 'kind: Pod',
    });
    expect(onImported).not.toHaveBeenCalled();
  });
});
