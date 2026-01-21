import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils';
import { createMockElectronAPI } from '../utils/mocks';
import { Settings } from '../../pages/Settings';

// Mock simple hooks
vi.mock('../../hooks/useLocalStorage', () => ({
  useLocalStorage: (key: string, initial: any) => {
    let val = initial;
    const setVal = vi.fn((newVal) => { val = newVal; });
    return [val, setVal];
  }
}));

describe('Settings Page', () => {
    const mockApi = createMockElectronAPI({
        getKubeconfigPath: vi.fn().mockResolvedValue({ success: true, data: 'C:\\test\\config' }),
        setKubeconfigPath: vi.fn().mockResolvedValue({ success: true, data: true })
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch and display initial kubeconfig path', async () => {
        render(<Settings />, { api: mockApi });

        await waitFor(() => {
            expect(screen.getByDisplayValue('C:\\test\\config')).toBeInTheDocument();
        });
    });

    it('should update kubeconfig path when set button is clicked', async () => {
        render(<Settings />, { api: mockApi });

        const input = await screen.findByPlaceholderText(/e.g. C:/i);
        fireEvent.change(input, { target: { value: 'C:\\new\\config' } });

        const button = screen.getByRole('button', { name: /set/i });
        fireEvent.click(button);

        expect(mockApi.setKubeconfigPath).toHaveBeenCalledWith('C:\\new\\config');
    });

    it('should render core inputs', () => {
        render(<Settings />, { api: mockApi });
        expect(screen.getByLabelText('Default Namespace')).toBeInTheDocument();
        expect(screen.getByLabelText('Auto-Refresh Data')).toBeInTheDocument();
    });
});
