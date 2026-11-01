import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleAsyncOperation } from '../../lib/async-operation-handler';
import { mockToast } from '../mocks/toast-mock';

describe('handleAsyncOperation', () => {
  const options = {
    loadingMessage: 'Deleting cluster...',
    successMessage: 'Cluster deleted.',
    errorTitle: 'Failed to delete cluster',
  };

  beforeEach(() => {
    mockToast.loading.mockReturnValue('toast-1');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('turns the loading toast into a success and runs onSuccess', async () => {
    const onSuccess = vi.fn();
    const result = await handleAsyncOperation(
      async () => ({ success: true, data: 42 }),
      { ...options, onSuccess }
    );

    expect(result).toEqual({ success: true, data: 42 });
    expect(mockToast.loading).toHaveBeenCalledWith('Deleting cluster...');
    expect(mockToast.success).toHaveBeenCalledWith('Cluster deleted.', {
      id: 'toast-1',
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('succeeds without an onSuccess callback', async () => {
    const result = await handleAsyncOperation(
      async () => ({ success: true, data: undefined }),
      options
    );

    expect(result.success).toBe(true);
    expect(mockToast.success).toHaveBeenCalledTimes(1);
  });

  it('reports the error of a failed result on the same toast', async () => {
    const onSuccess = vi.fn();
    const result = await handleAsyncOperation(
      async () => ({ success: false, error: 'cluster is busy' }),
      { ...options, onSuccess }
    );

    expect(result).toEqual({ success: false, error: 'cluster is busy' });
    expect(mockToast.error).toHaveBeenCalledWith('Failed to delete cluster', {
      description: 'cluster is busy',
      duration: 5000,
      id: 'toast-1',
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('builds a message from the title when a failed result has no error', async () => {
    const result = await handleAsyncOperation(
      async () => ({ success: false, error: '' }),
      options
    );

    expect(result).toEqual({
      success: false,
      error: 'Failed to delete cluster failed',
    });
    expect(mockToast.error).toHaveBeenCalledWith(
      'Failed to delete cluster',
      expect.objectContaining({
        description: 'Failed to delete cluster failed',
        id: 'toast-1',
      })
    );
  });

  it('returns the message of a thrown Error', async () => {
    const result = await handleAsyncOperation(async () => {
      throw new Error('connection refused');
    }, options);

    expect(result).toEqual({ success: false, error: 'connection refused' });
    expect(mockToast.error).toHaveBeenCalledWith(
      'Failed to delete cluster',
      expect.objectContaining({
        description: 'connection refused',
        id: 'toast-1',
      })
    );
  });

  it('returns a generic message when something other than an Error is thrown', async () => {
    const result = await handleAsyncOperation(async () => {
      throw 'nope';
    }, options);

    expect(result).toEqual({
      success: false,
      error: 'An unexpected error occurred.',
    });
  });

  it('reports a failing onSuccess callback as a failure', async () => {
    const result = await handleAsyncOperation(
      async () => ({ success: true, data: 1 }),
      {
        ...options,
        onSuccess: async () => {
          throw new Error('refresh failed');
        },
      }
    );

    expect(result).toEqual({ success: false, error: 'refresh failed' });
    expect(mockToast.success).toHaveBeenCalledTimes(1);
    expect(mockToast.error).toHaveBeenCalledTimes(1);
  });
});
