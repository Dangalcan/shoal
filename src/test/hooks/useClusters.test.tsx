import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ApiProvider } from '../../services/api-context';
import { ClusterProvider } from '../../features/clusters/ClusterContext';
import { createMockElectronAPI } from '../utils/mocks';
import { useClusters } from '../../hooks/useClusters';

describe('useClusters Hook', () => {
    it('should fetch current context on mount', async () => {
        const mockApi = createMockElectronAPI({
            getClusters: vi.fn().mockResolvedValue({
                success: true,
                data: ['cluster-1'],
            }),
            getCurrentContext: vi.fn().mockResolvedValue({
                success: true,
                data: 'cluster-1',
            }),
        });

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <ApiProvider api={mockApi}>
                <ClusterProvider>
                    {children}
                </ClusterProvider>
            </ApiProvider>
        );

        const { result } = renderHook(() => useClusters(), { wrapper });

        await waitFor(() => {
            expect(result.current.currentContext).toBe('cluster-1');
        });
    });

    it('should switch context and refresh data', async () => {
        const switchContextMock = vi.fn().mockResolvedValue({ success: true });
        const mockApi = createMockElectronAPI({
            getClusters: vi.fn().mockResolvedValue({
                success: true,
                data: ['cluster-1', 'cluster-2'],
            }),
            switchContext: switchContextMock,
            getCurrentContext: vi.fn().mockImplementation(async () => ({
                success: true,
                data: switchContextMock.mock.calls.length > 0 ? 'cluster-2' : 'cluster-1'
            })),
        });

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <ApiProvider api={mockApi}>
                <ClusterProvider>
                    {children}
                </ClusterProvider>
            </ApiProvider>
        );

        const { result } = renderHook(() => useClusters(), { wrapper });

        await waitFor(() => {
            expect(result.current.currentContext).toBe('cluster-1');
        });

        await result.current.switchContext('cluster-2');

        expect(switchContextMock).toHaveBeenCalledWith('cluster-2');
        expect(result.current.switching).toBe(null); // Should reset after switch
        
        await waitFor(() => {
            expect(result.current.currentContext).toBe('cluster-2');
        });
    });
});
