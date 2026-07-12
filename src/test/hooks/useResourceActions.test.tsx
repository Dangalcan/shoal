import { renderHook, act } from '@testing-library/react';
import { useResourceActions } from '../../hooks/useResourceActions';
import { useApi } from '../../services/api-context';
import { handleAsyncOperation } from '../../lib/async-operation-handler';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/api-context', () => ({
    useApi: vi.fn(),
}));

vi.mock('../../lib/async-operation-handler', () => ({
    handleAsyncOperation: vi.fn(),
}));

describe('useResourceActions', () => {
    const mockApi = {
        rolloutRestart: vi.fn(),
        deleteResource: vi.fn(),
        scaleResource: vi.fn(),
    };
    const onActionComplete = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useApi).mockReturnValue(mockApi as any);
    });

    it('should call api.rolloutRestart when handleRestart is called with context', async () => {
        const { result } = renderHook(() => useResourceActions('test-ctx', onActionComplete));
        
        await act(async () => {
            await result.current.handleRestart('res', 'ns', 'Deployment');
        });

        expect(handleAsyncOperation).toHaveBeenCalled();
        // Extract the first argument (operation function) and call it
        const operation = vi.mocked(handleAsyncOperation).mock.calls[0][0];
        await operation();

        expect(mockApi.rolloutRestart).toHaveBeenCalledWith({
            contextName: 'test-ctx',
            resourceType: 'Deployment',
            resourceName: 'res',
            namespace: 'ns',
        });
    });

    it('should NOT call api when handleRestart is called without context', async () => {
        const { result } = renderHook(() => useResourceActions(undefined, onActionComplete));
        
        await act(async () => {
            await result.current.handleRestart('res', 'ns', 'Deployment');
        });

        expect(handleAsyncOperation).not.toHaveBeenCalled();
        expect(mockApi.rolloutRestart).not.toHaveBeenCalled();
    });

    it('should call api.deleteResource when handleDelete is called with context', async () => {
        const { result } = renderHook(() => useResourceActions('test-ctx', onActionComplete));
        
        await act(async () => {
            await result.current.handleDelete('res', 'ns', 'Pod');
        });

        expect(handleAsyncOperation).toHaveBeenCalled();
        const operation = vi.mocked(handleAsyncOperation).mock.calls[0][0];
        await operation();

        expect(mockApi.deleteResource).toHaveBeenCalledWith({
            contextName: 'test-ctx',
            resourceType: 'Pod',
            resourceName: 'res',
            namespace: 'ns',
        });
    });

    it('should NOT call api when handleDelete is called without context', async () => {
        const { result } = renderHook(() => useResourceActions(undefined, onActionComplete));

        await act(async () => {
            await result.current.handleDelete('res', 'ns', 'Pod');
        });

        expect(handleAsyncOperation).not.toHaveBeenCalled();
        expect(mockApi.deleteResource).not.toHaveBeenCalled();
    });

    it('should call api.scaleResource when handleScale is called with context', async () => {
        const { result } = renderHook(() => useResourceActions('test-ctx', onActionComplete));

        await act(async () => {
            await result.current.handleScale('res', 'ns', 'deployments', 4);
        });

        expect(handleAsyncOperation).toHaveBeenCalled();
        const operation = vi.mocked(handleAsyncOperation).mock.calls[0][0];
        await operation();

        expect(mockApi.scaleResource).toHaveBeenCalledWith({
            contextName: 'test-ctx',
            resourceType: 'deployments',
            resourceName: 'res',
            namespace: 'ns',
            replicas: 4,
        });
    });

    it('should NOT call api when handleScale is called without context', async () => {
        const { result } = renderHook(() => useResourceActions(undefined, onActionComplete));

        await act(async () => {
            await result.current.handleScale('res', 'ns', 'deployments', 4);
        });

        expect(handleAsyncOperation).not.toHaveBeenCalled();
        expect(mockApi.scaleResource).not.toHaveBeenCalled();
    });
});
