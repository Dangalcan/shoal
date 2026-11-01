import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../utils';
import { createMockElectronAPI } from '../utils/mocks';
import { Settings } from '../../pages/Settings';

// Mock simple hooks
vi.mock('../../hooks/useLocalStorage', () => ({
  useLocalStorage: (_key: string, initial: any) => {
    // We need a way to store/retrieve values to simulate state persistence if needed,
    // but for simple interactions, a mock implementation that behaves like useState is enough.
    // However, since we want to verify values, we can just use a simple state impl.
    // Ideally we would use a real generic hook mock but this simple one was here.
    // Let's make it a bit more robust or just rely on component state updates.
    // Actually, capturing the setter allows us to spy on it?
    // For now, let's keep the simple implementation but ensure it works.
    let val = initial;
    const setVal = vi.fn((newVal) => {
      val = newVal;
    });
    return [val, setVal];
  },
}));

// Mock hooks that are used in Settings
vi.mock('../../features/settings', () => {
  // We can mock the specific hook or use the real one if we want integration.
  // The original test didn't mock useSettings, meaning it used the real one (integration).
  // But useSettings uses useLocalStorage which IS mocked.
  // And it calls useApi.

  // To make testing easier and strictly about UI -> Handler connection, we can mock useSettings.
  // This gives us full control over the values passed to the component.
  return {
    useSettings: vi.fn(),
  };
});

vi.mock('../../hooks', () => ({
  useNamespaces: vi.fn(),
  useClusters: vi.fn().mockReturnValue({ currentContext: 'test-context' }),
}));

import { useSettings } from '../../features/settings';
import { useNamespaces } from '../../hooks';

describe('Settings Page', () => {
  const mockApi = createMockElectronAPI({});

  // Default mock values
  const mockSettingsValues = {
    kubeconfigPath: 'C:\\default\\config',
    defaultNamespace: 'default',
    autoRefresh: true,
    refreshInterval: 10,
    saving: false,
    localSettingsSaved: false,
    setKubeconfigPath: vi.fn(),
    setDefaultNamespace: vi.fn(),
    setAutoRefresh: vi.fn(),
    setRefreshInterval: vi.fn(),
    handleSaveKubeconfig: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default hook returns
    vi.mocked(useSettings).mockReturnValue(mockSettingsValues);
    vi.mocked(useNamespaces).mockReturnValue({
      namespaces: ['default', 'kube-system', 'all'],
      selectedNamespace: 'all',
      setSelectedNamespace: vi.fn(),
      loading: false,
      error: null,
    });
  });

  it('should display all settings with correct initial values', () => {
    render(<Settings />, { api: mockApi });

    expect(screen.getByDisplayValue('C:\\default\\config')).toBeInTheDocument();
    expect(screen.getByDisplayValue('default')).toBeInTheDocument(); // Namespace select
    expect(screen.getByLabelText('Auto-Refresh Data')).toBeChecked();
    expect(screen.getByText('10s')).toBeInTheDocument();
  });

  it('should update kubeconfig path input', () => {
    render(<Settings />, { api: mockApi });

    const input = screen.getByPlaceholderText(/config-custom/);
    fireEvent.change(input, { target: { value: 'C:\\new\\config' } });

    expect(mockSettingsValues.setKubeconfigPath).toHaveBeenCalledWith(
      'C:\\new\\config'
    );
  });

  it('should call handleSaveKubeconfig when set button is clicked', () => {
    render(<Settings />, { api: mockApi });

    fireEvent.click(screen.getByText('Set'));

    expect(mockSettingsValues.handleSaveKubeconfig).toHaveBeenCalled();
  });

  it('should show loading state on set button', () => {
    vi.mocked(useSettings).mockReturnValue({
      ...mockSettingsValues,
      saving: true,
      localSettingsSaved: false,
    });

    render(<Settings />, { api: mockApi });

    expect(screen.getByRole('button', { name: /set/i })).toBeDisabled();
    // Assuming the button shows a spinner or loading text, checking disabled is a start.
  });

  it('should update default namespace', () => {
    render(<Settings />, { api: mockApi });

    const select = screen.getByLabelText('Default Namespace');
    fireEvent.change(select, { target: { value: 'kube-system' } });

    expect(mockSettingsValues.setDefaultNamespace).toHaveBeenCalledWith(
      'kube-system'
    );
  });

  it('should disabled namespace selector when loading namespaces', () => {
    vi.mocked(useNamespaces).mockReturnValue({
      namespaces: [],
      selectedNamespace: 'all',
      setSelectedNamespace: vi.fn(),
      loading: true,
      error: null,
    });

    render(<Settings />, { api: mockApi });

    expect(screen.getByLabelText('Default Namespace')).toBeDisabled();
  });

  it('should toggle auto-refresh', () => {
    render(<Settings />, { api: mockApi });

    const checkbox = screen.getByLabelText('Auto-Refresh Data');
    fireEvent.click(checkbox);

    // Since it was true, clicking should set it to false (handled by parent logic, we verify call)
    expect(mockSettingsValues.setAutoRefresh).toHaveBeenCalledWith(false);
  });

  it('should update refresh interval', () => {
    render(<Settings />, { api: mockApi });

    const range = screen.getByLabelText('Refresh Interval');
    fireEvent.change(range, { target: { value: '30' } });

    expect(mockSettingsValues.setRefreshInterval).toHaveBeenCalledWith(30);
  });

  it('should hide refresh interval when auto-refresh is disabled', () => {
    vi.mocked(useSettings).mockReturnValue({
      ...mockSettingsValues,
      autoRefresh: false,
      localSettingsSaved: false,
    });

    const { container } = render(<Settings />, { api: mockApi });

    // Implementation uses a class "settings-page--hidden"
    // We can check if the input is not visible or check for the class on parent
    // Use a more robust check if possible, or just check implementation details if CSS is not loaded in test
    // Vitest/JSDOM doesn't compute styles perfectly unless configured.
    // Let's check if the class is applied.
    const rangeGroup = container.querySelector('.settings-page--hidden');
    expect(rangeGroup).toBeInTheDocument();
  });

  it('confirms a saved local setting in the footer', () => {
    vi.mocked(useSettings).mockReturnValue({
      ...mockSettingsValues,
      localSettingsSaved: true,
    });

    render(<Settings />, { api: mockApi });

    expect(screen.getByText('Settings saved.')).toBeInTheDocument();
    expect(
      screen.queryByText('Settings are saved automatically.')
    ).not.toBeInTheDocument();
  });

  it('says settings save automatically while nothing was just saved', () => {
    render(<Settings />, { api: mockApi });

    expect(
      screen.getByText('Settings are saved automatically.')
    ).toBeInTheDocument();
  });

  it('selects All Namespaces when no default namespace is stored', () => {
    vi.mocked(useSettings).mockReturnValue({
      ...mockSettingsValues,
      defaultNamespace: '',
    });

    render(<Settings />, { api: mockApi });

    expect(screen.getByLabelText('Default Namespace')).toHaveValue('all');
  });

  it('suggests a Windows kubeconfig path on Windows', () => {
    const userAgent = vi
      .spyOn(navigator, 'userAgent', 'get')
      .mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    try {
      render(<Settings />, { api: mockApi });

      expect(screen.getByLabelText('Kubeconfig Path')).toHaveAttribute(
        'placeholder',
        'e.g. C:\\Users\\you\\.kube\\config-custom'
      );
    } finally {
      userAgent.mockRestore();
    }
  });

  it('suggests a home-relative kubeconfig path elsewhere', () => {
    const userAgent = vi
      .spyOn(navigator, 'userAgent', 'get')
      .mockReturnValue('Mozilla/5.0 (X11; Linux x86_64)');
    try {
      render(<Settings />, { api: mockApi });

      expect(screen.getByLabelText('Kubeconfig Path')).toHaveAttribute(
        'placeholder',
        'e.g. ~/.kube/config-custom'
      );
    } finally {
      userAgent.mockRestore();
    }
  });
});
