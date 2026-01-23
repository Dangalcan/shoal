import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '../../utils';
import { createMockElectronAPI } from '../../utils/mocks';
import { ContextSwitcher } from '../../../components/common/ContextSwitcher';

describe('ContextSwitcher', () => {
    it('should render current context', async () => {
        const mockApi = createMockElectronAPI({
            getClusters: vi.fn().mockResolvedValue({
                success: true,
                data: ['cluster-1', 'cluster-2'],
            }),
            getCurrentContext: vi.fn().mockResolvedValue({
                success: true,
                data: 'cluster-1',
            }),
        });

        render(<ContextSwitcher />, { api: mockApi });

        await waitFor(() => {
            expect(screen.getByText('cluster-1')).toBeInTheDocument();
        });
    });

    it('should list available contexts', async () => {
        const mockApi = createMockElectronAPI({
            getClusters: vi.fn().mockResolvedValue({
                success: true,
                data: ['cluster-1', 'cluster-2'],
            }),
            getCurrentContext: vi.fn().mockResolvedValue({
                success: true,
                data: 'cluster-1',
            }),
        });

        render(<ContextSwitcher />, { api: mockApi });

        await waitFor(() => {
            expect(screen.getByText('cluster-1')).toBeInTheDocument();
        });

        // Open dropdown
        const trigger = screen.getByText('cluster-1').closest('button');
        fireEvent.click(trigger!);

        await waitFor(() => {
            expect(screen.getByText(/available contexts/i)).toBeInTheDocument();
            expect(screen.getByText('cluster-2')).toBeInTheDocument();
        });
    });

    it('should call switchContext when clicking a context', async () => {
        const switchContextMock = vi.fn().mockResolvedValue({ success: true });
        const mockApi = createMockElectronAPI({
            getClusters: vi.fn().mockResolvedValue({
                success: true,
                data: ['cluster-1', 'cluster-2'],
            }),
            getCurrentContext: vi.fn().mockResolvedValue({
                success: true,
                data: 'cluster-1',
            }),
            switchContext: switchContextMock,
        });

        render(<ContextSwitcher />, { api: mockApi });

        await waitFor(() => {
            expect(screen.getByText('cluster-1')).toBeInTheDocument();
        });

        // Open dropdown
        const trigger = screen.getByText('cluster-1').closest('button');
        fireEvent.click(trigger!);

        // Click new context
        const newContext = screen.getByText('cluster-2');
        fireEvent.click(newContext);

        await waitFor(() => {
            expect(switchContextMock).toHaveBeenCalledWith('cluster-2');
        });
    });
});
