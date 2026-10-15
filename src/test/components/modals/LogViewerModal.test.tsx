import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Unmock component for unit testing
vi.unmock('../../../components/modals/LogViewerModal');

import { render, screen, waitFor, fireEvent, act } from '../../utils';
import { LogViewerModal } from '../../../components/modals/LogViewerModal';
import { mockElectronAPI } from '../../setup';

describe('LogViewerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    mockElectronAPI.getLogs.mockResolvedValue({
      success: true,
      data: 'Test logs',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not render when closed', () => {
    const { container } = render(
      <LogViewerModal
        isOpen={false}
        onClose={vi.fn()}
        clusterName="test"
        podName="test"
        namespace="default"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should call getLogs API when open', async () => {
    mockElectronAPI.getLogs.mockResolvedValue({
      success: true,
      data: 'Test logs',
    });

    render(
      <LogViewerModal
        isOpen={true}
        onClose={vi.fn()}
        clusterName="test-cluster"
        podName="test-pod"
        namespace="default"
      />
    );

    await waitFor(() => {
      expect(window.electron.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          contextName: 'test-cluster',
          podName: 'test-pod',
          namespace: 'default',
          tailLines: 200,
        })
      );
    });
    expect(
      await screen.findByText('Test logs', {}, { timeout: 3000 })
    ).toBeInTheDocument();
  });

  it('should display error when getLogs fails', async () => {
    mockElectronAPI.getLogs.mockResolvedValueOnce({
      success: false,
      error: 'Failed to fetch logs',
    });

    render(
      <LogViewerModal
        isOpen={true}
        onClose={vi.fn()}
        clusterName="test-cluster"
        podName="test-pod"
        namespace="default"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch logs')).toBeInTheDocument();
    });
  });

  it('should toggle auto-refresh', async () => {
    vi.useFakeTimers();
    render(
      <LogViewerModal
        isOpen={true}
        onClose={vi.fn()}
        clusterName="test-cluster"
        podName="test-pod"
        namespace="default"
      />
    );

    const autoRefreshBtn = screen.getByRole('button', {
      name: /auto-refresh/i,
    });
    // Click to enable
    fireEvent.click(autoRefreshBtn);
    expect(autoRefreshBtn).toHaveClass('active');

    // Fast forward time
    await vi.advanceTimersByTimeAsync(5500);

    // Should have called getLogs again (initial + 1 interval)
    // Note: initial call is 1, interval is 1. Total 2.
    // We verify call count > 1
    expect(window.electron.getLogs).toHaveBeenCalledTimes(2);

    // Click to disable
    fireEvent.click(autoRefreshBtn);
    expect(autoRefreshBtn).not.toHaveClass('active');

    vi.useRealTimers();
  });

  it('should filter logs based on search query', async () => {
    mockElectronAPI.getLogs.mockResolvedValue({
      success: true,
      data: 'Error: Something went wrong\nInfo: Server started\nWarning: Low memory',
    });

    render(
      <LogViewerModal
        isOpen={true}
        onClose={vi.fn()}
        clusterName="test-cluster"
        podName="test-pod"
        namespace="default"
      />
    );

    // Wait for logs to load
    await screen.findByText(
      'Info: Server started',
      { exact: false },
      { timeout: 3000 }
    );

    const { act } = await import('@testing-library/react');
    const searchInput = screen.getByPlaceholderText('Filter logs...');

    act(() => {
      fireEvent.change(searchInput, { target: { value: 'Error' } });
    });

    // Wait for 'Info' to disappear (filtering applied)
    await waitFor(() => {
      expect(
        screen.queryByText('Info: Server started', { exact: false })
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByText('Error: Something went wrong', { exact: false })
    ).toBeInTheDocument();
  });

  it('should display empty message when no logs', async () => {
    mockElectronAPI.getLogs.mockResolvedValue({
      success: true,
      data: '',
    });

    render(
      <LogViewerModal
        isOpen={true}
        onClose={vi.fn()}
        clusterName="test-cluster"
        podName="test-pod"
        namespace="default"
      />
    );

    // Component sets "No logs found." fallback when logs are empty string
    expect(
      await screen.findByText('No logs found.', {}, { timeout: 3000 })
    ).toBeInTheDocument();
  });

  it('starts blank for the next pod and asks for the chosen container', async () => {
    mockElectronAPI.getLogs.mockResolvedValue({
      success: true,
      data: 'lines of pod-a',
    });
    const { rerender } = render(
      <LogViewerModal
        isOpen={true}
        onClose={vi.fn()}
        clusterName="c"
        podName="pod-a"
        namespace="default"
        containers={['app', 'sidecar']}
      />
    );
    await waitFor(() =>
      expect(screen.getByText('lines of pod-a')).toBeInTheDocument()
    );
    // Until the user picks one, the first container is requested, which is
    // also the one the picker shows.
    expect(window.electron.getLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ podName: 'pod-a', container: 'app' })
    );

    fireEvent.change(screen.getByLabelText('Container'), {
      target: { value: 'sidecar' },
    });
    await waitFor(() =>
      expect(window.electron.getLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ podName: 'pod-a', container: 'sidecar' })
      )
    );

    mockElectronAPI.getLogs.mockImplementation(() => new Promise(() => {}));
    rerender(
      <LogViewerModal
        isOpen={true}
        onClose={vi.fn()}
        clusterName="c"
        podName="pod-b"
        namespace="default"
      />
    );
    await waitFor(() =>
      expect(screen.queryByText('lines of pod-a')).not.toBeInTheDocument()
    );
    expect(screen.getByText('Fetching logs...')).toBeInTheDocument();
    expect(screen.queryByLabelText('Container')).toBeNull();
  });

  it('ignores a late answer from the pod opened before', async () => {
    let answerPodA: (value: { success: true; data: string }) => void = () => {};
    mockElectronAPI.getLogs.mockImplementation(
      ({ podName }: { podName: string }) =>
        podName === 'pod-a'
          ? new Promise<{ success: true; data: string }>((resolve) => {
              answerPodA = resolve;
            })
          : Promise.resolve({ success: true as const, data: 'lines of pod-b' })
    );
    const props = {
      isOpen: true,
      onClose: vi.fn(),
      clusterName: 'c',
      namespace: 'default',
    };
    const { rerender } = render(<LogViewerModal {...props} podName="pod-a" />);
    await waitFor(() =>
      expect(window.electron.getLogs).toHaveBeenCalledTimes(1)
    );

    rerender(<LogViewerModal {...props} podName="pod-b" />);
    await waitFor(() =>
      expect(screen.getByText('lines of pod-b')).toBeInTheDocument()
    );

    // pod-a answers after pod-b is on screen: its lines must not win.
    await act(async () => {
      answerPodA({ success: true, data: 'lines of pod-a' });
    });
    expect(screen.getByText('lines of pod-b')).toBeInTheDocument();
    expect(screen.queryByText('lines of pod-a')).not.toBeInTheDocument();
    expect(screen.queryByText('Fetching logs...')).not.toBeInTheDocument();
  });

  it('starts blank when the same pod is opened on another cluster', async () => {
    mockElectronAPI.getLogs.mockResolvedValue({
      success: true,
      data: 'lines on cluster one',
    });
    const props = {
      isOpen: true,
      onClose: vi.fn(),
      podName: 'pod-a',
      namespace: 'default',
    };
    const { rerender } = render(
      <LogViewerModal {...props} clusterName="one" />
    );
    await waitFor(() =>
      expect(screen.getByText('lines on cluster one')).toBeInTheDocument()
    );

    mockElectronAPI.getLogs.mockImplementation(() => new Promise(() => {}));
    rerender(<LogViewerModal {...props} clusterName="two" />);
    await waitFor(() =>
      expect(screen.queryByText('lines on cluster one')).not.toBeInTheDocument()
    );
    expect(window.electron.getLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ contextName: 'two', podName: 'pod-a' })
    );
  });

  it('copies the visible lines', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    render(
      <LogViewerModal
        isOpen={true}
        onClose={vi.fn()}
        clusterName="c"
        podName="pod-a"
        namespace="default"
      />
    );
    await waitFor(() =>
      expect(screen.getByText('Test logs')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTitle('Copy logs'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Test logs'));
  });
});
