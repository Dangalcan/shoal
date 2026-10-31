import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../utils';
import { createMockElectronAPI } from '../../utils/mocks';
import { PodTerminalModal } from '../../../components/modals/PodTerminalModal';

// Stub the xterm-backed Terminal child so this test does not pull in @xterm/*.
vi.mock('../../../components/Terminal', () => ({
  Terminal: (props: any) => (
    <div data-testid="terminal" data-session={props.sessionId} />
  ),
}));

const baseProps = {
  podName: 'p1',
  namespace: 'ns',
  contextName: 'ctx',
  onClose: vi.fn(),
};

let api: ReturnType<typeof createMockElectronAPI>;

beforeEach(() => {
  api = createMockElectronAPI({
    terminalCreate: vi.fn().mockResolvedValue({
      success: true,
      data: { sessionId: 'sess-1', shellFamily: 'unix' },
    }),
    terminalKill: vi.fn().mockResolvedValue({ success: true, data: true }),
  });
});

describe('PodTerminalModal', () => {
  it('opens and connects a pod-exec session', async () => {
    render(<PodTerminalModal isOpen {...baseProps} />, { api });

    expect(api.terminalCreate).toHaveBeenCalledWith({
      kind: 'pod-exec',
      podName: 'p1',
      namespace: 'ns',
      contextName: 'ctx',
      shell: '/bin/sh',
    });

    await waitFor(() =>
      expect(screen.getByTestId('terminal')).toBeInTheDocument()
    );
    expect(screen.getByTestId('terminal')).toHaveAttribute(
      'data-session',
      'sess-1'
    );
    expect(
      screen.getByRole('button', { name: /reconnect/i })
    ).toBeInTheDocument();
  });

  it('shows an error when connection fails', async () => {
    api.terminalCreate.mockResolvedValue({
      success: false,
      error: 'exec failed',
    });

    render(<PodTerminalModal isOpen {...baseProps} />, { api });

    await waitFor(() =>
      expect(screen.getByText('exec failed')).toBeInTheDocument()
    );
    expect(screen.queryByTestId('terminal')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /reconnect/i })
    ).toBeInTheDocument();
  });

  it('re-creates the session when the shell changes', async () => {
    render(<PodTerminalModal isOpen {...baseProps} />, { api });
    await waitFor(() =>
      expect(screen.getByTestId('terminal')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText('Shell'), {
      target: { value: '/bin/bash' },
    });

    await waitFor(() =>
      expect(api.terminalCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({ shell: '/bin/bash' })
      )
    );
    expect(api.terminalKill).toHaveBeenCalledWith('sess-1');
  });

  it('reconnects: kills the old session and creates a new one', async () => {
    render(<PodTerminalModal isOpen {...baseProps} />, { api });
    await waitFor(() =>
      expect(screen.getByTestId('terminal')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /reconnect/i }));

    await waitFor(() =>
      expect(api.terminalKill).toHaveBeenCalledWith('sess-1')
    );
    expect(api.terminalCreate).toHaveBeenCalledTimes(2);
  });

  it('kills the session when the modal closes', async () => {
    const { rerender } = render(<PodTerminalModal isOpen {...baseProps} />, {
      api,
    });
    await waitFor(() =>
      expect(screen.getByTestId('terminal')).toBeInTheDocument()
    );

    rerender(<PodTerminalModal isOpen={false} {...baseProps} />);

    await waitFor(() =>
      expect(api.terminalKill).toHaveBeenCalledWith('sess-1')
    );
    expect(screen.queryByTestId('terminal')).not.toBeInTheDocument();
  });

  it('keeps the chosen shell for the next opening', async () => {
    const { rerender } = render(<PodTerminalModal isOpen {...baseProps} />, {
      api,
    });
    await waitFor(() =>
      expect(screen.getByTestId('terminal')).toBeInTheDocument()
    );
    fireEvent.change(screen.getByLabelText('Shell'), {
      target: { value: '/bin/bash' },
    });

    rerender(<PodTerminalModal isOpen={false} {...baseProps} />);
    rerender(<PodTerminalModal isOpen {...baseProps} />);

    expect(screen.getByLabelText('Shell')).toHaveValue('/bin/bash');
    await waitFor(() =>
      expect(api.terminalCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({ shell: '/bin/bash' })
      )
    );
  });
});
