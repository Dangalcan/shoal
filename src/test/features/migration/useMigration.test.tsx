import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { useMigration } from '../../../features/migration/useMigration';
import { useApi } from '../../../services/api-context';
import { createMockElectronAPI } from '../../utils/mocks';
import type { ComposeConversion } from '../../../types.d';

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

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
  },
}));

const conversion: ComposeConversion = {
  manifests: [
    {
      fileName: 'web-deployment.yaml',
      kind: 'Deployment',
      name: 'web',
      content: 'kind: Deployment',
    },
    {
      fileName: 'web-service.yaml',
      kind: 'Service',
      name: 'web',
      content: 'kind: Service',
    },
  ],
  warnings: ['Volume mount on service "web" will not work'],
  locallyBuiltImages: ['api'],
};

describe('useMigration', () => {
  let mockApi: ReturnType<typeof createMockElectronAPI>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockElectronAPI({
      getCurrentContext: vi
        .fn()
        .mockResolvedValue({ success: true, data: 'kind-test' }),
      migrationConvertCompose: vi
        .fn()
        .mockResolvedValue({ success: true, data: conversion }),
    });
    vi.mocked(useApi).mockReturnValue(mockApi);
  });

  it('checks kompose availability on mount', async () => {
    const { result } = renderHook(() => useMigration());

    await waitFor(() =>
      expect(result.current.komposeStatus).toEqual({
        available: true,
        version: '1.34.0',
      })
    );
    expect(result.current.step).toBe('select');
  });

  it('converts the selected compose file and moves to review', async () => {
    const { result } = renderHook(() => useMigration());
    await waitFor(() => expect(result.current.komposeStatus).not.toBeNull());

    await act(() => result.current.selectAndConvert());

    // The hook converts by the dialog's token and shows the path.
    expect(mockApi.migrationConvertCompose).toHaveBeenCalledWith(
      'mock-compose-token'
    );
    expect(result.current.step).toBe('review');
    expect(result.current.composePath).toBe('C:/project/docker-compose.yml');
    expect(result.current.conversion?.manifests).toHaveLength(2);
  });

  it('stays on select when the file dialog is cancelled', async () => {
    mockApi.migrationSelectComposeFile = vi
      .fn()
      .mockResolvedValue({ success: true, data: null });
    const { result } = renderHook(() => useMigration());

    await act(() => result.current.selectAndConvert());

    expect(mockApi.migrationConvertCompose).not.toHaveBeenCalled();
    expect(result.current.step).toBe('select');
  });

  it('edits and removes manifests in the review step', async () => {
    const { result } = renderHook(() => useMigration());
    await act(() => result.current.selectAndConvert());

    act(() => result.current.updateManifest(0, 'kind: DaemonSet'));
    expect(result.current.conversion?.manifests[0].content).toBe(
      'kind: DaemonSet'
    );

    act(() => result.current.removeManifest(1));
    expect(result.current.conversion?.manifests).toHaveLength(1);
  });

  it('imports manifests for the current context and moves to done', async () => {
    const { result } = renderHook(() => useMigration());
    await waitFor(() =>
      expect(result.current.currentContext).toBe('kind-test')
    );
    await act(() => result.current.selectAndConvert());

    await act(() => result.current.importManifests('my-shop'));

    expect(mockApi.migrationImportManifests).toHaveBeenCalledWith({
      projectName: 'my-shop',
      contextName: 'kind-test',
      manifests: [
        { name: 'web-deployment.yaml', content: 'kind: Deployment' },
        { name: 'web-service.yaml', content: 'kind: Service' },
      ],
    });
    expect(result.current.step).toBe('done');
    expect(result.current.importResult).toEqual({
      folderId: 1,
      manifestIds: [1],
    });
  });

  it('refuses to import when no cluster context is active', async () => {
    mockApi.getCurrentContext = vi
      .fn()
      .mockResolvedValue({ success: true, data: 'None' });
    const { result } = renderHook(() => useMigration());
    await act(() => result.current.selectAndConvert());

    const outcome = await act(() => result.current.importManifests('my-shop'));

    expect(outcome.success).toBe(false);
    expect(mockApi.migrationImportManifests).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/no active cluster context/i)
    );
  });

  it('resets back to the select step', async () => {
    const { result } = renderHook(() => useMigration());
    await act(() => result.current.selectAndConvert());
    expect(result.current.step).toBe('review');

    act(() => result.current.reset());

    expect(result.current.step).toBe('select');
    expect(result.current.conversion).toBeNull();
    expect(result.current.composePath).toBeNull();
  });

  it('reports a file picker that fails', async () => {
    mockApi.migrationSelectComposeFile = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'dialog crashed' });
    const { result } = renderHook(() => useMigration());

    await act(() => result.current.selectAndConvert());

    expect(toast.error).toHaveBeenCalledWith('dialog crashed');
    expect(mockApi.migrationConvertCompose).not.toHaveBeenCalled();
    expect(result.current.step).toBe('select');
  });

  it('falls back to a generic message when the picker fails silently', async () => {
    mockApi.migrationSelectComposeFile = vi
      .fn()
      .mockResolvedValue({ success: false });
    const { result } = renderHook(() => useMigration());

    await act(() => result.current.selectAndConvert());

    expect(toast.error).toHaveBeenCalledWith('Failed to open the file picker');
  });

  it('stays on select when kompose cannot convert the file', async () => {
    mockApi.migrationConvertCompose = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'invalid compose file' });
    const { result } = renderHook(() => useMigration());

    await act(() => result.current.selectAndConvert());

    expect(result.current.step).toBe('select');
    expect(result.current.conversion).toBeNull();
    expect(result.current.composePath).toBeNull();
    expect(result.current.converting).toBe(false);
  });

  it('ignores manifest edits before anything was converted', () => {
    const { result } = renderHook(() => useMigration());

    act(() => result.current.updateManifest(0, 'kind: Pod'));
    act(() => result.current.removeManifest(0));

    expect(result.current.conversion).toBeNull();
    expect(result.current.step).toBe('select');
  });

  it('refuses to import before anything was converted', async () => {
    const { result } = renderHook(() => useMigration());

    const outcome = await act(() => result.current.importManifests('my-shop'));

    expect(outcome).toEqual({ success: false });
    expect(toast.error).toHaveBeenCalledWith('Nothing to import');
    expect(mockApi.migrationImportManifests).not.toHaveBeenCalled();
  });

  it('refuses to import once every manifest was removed', async () => {
    mockApi.migrationConvertCompose = vi.fn().mockResolvedValue({
      success: true,
      data: { ...conversion, manifests: [conversion.manifests[0]] },
    });
    const { result } = renderHook(() => useMigration());
    await act(() => result.current.selectAndConvert());
    act(() => result.current.removeManifest(0));

    const outcome = await act(() => result.current.importManifests('my-shop'));

    expect(outcome).toEqual({ success: false });
    expect(toast.error).toHaveBeenCalledWith('Nothing to import');
    expect(result.current.step).toBe('review');
  });

  it('stays on review when the import fails', async () => {
    mockApi.migrationImportManifests = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'database locked' });
    const { result } = renderHook(() => useMigration());
    await waitFor(() =>
      expect(result.current.currentContext).toBe('kind-test')
    );
    await act(() => result.current.selectAndConvert());

    const outcome = await act(() => result.current.importManifests('my-shop'));

    expect(outcome).toEqual({ success: false });
    expect(result.current.step).toBe('review');
    expect(result.current.importResult).toBeNull();
    expect(result.current.importing).toBe(false);
  });
});
