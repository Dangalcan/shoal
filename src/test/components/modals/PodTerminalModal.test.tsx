import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../utils';
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

beforeEach(() => {
  window.electron.terminalCreate = vi
    .fn()
    .mockResolvedValue({ success: true, data: { sessionId: 'sess-1' } }) as any;
  window.electron.terminalKill = vi
    .fn()
    .mockResolvedValue({ success: true, data: undefined }) as any;
});

describe('PodTerminalModal', () => {
  it('opens and connects a pod-exec session', async () => {
    render(<PodTerminalModal isOpen {...baseProps} />);

    expect(window.electron.terminalCreate).toHaveBeenCalledWith({
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
    window.electron.terminalCreate = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'exec failed' }) as any;

    render(<PodTerminalModal isOpen {...baseProps} />);

    await waitFor(() =>
      expect(screen.getByText('exec failed')).toBeInTheDocument()
    );
    expect(screen.queryByTestId('terminal')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /reconnect/i })
    ).toBeInTheDocument();
  });

  it('re-creates the session when the shell changes', async () => {
    render(<PodTerminalModal isOpen {...baseProps} />);
    await waitFor(() =>
      expect(screen.getByTestId('terminal')).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText('Shell'), {
      target: { value: '/bin/bash' },
    });

    await waitFor(() =>
      expect(window.electron.terminalCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({ shell: '/bin/bash' })
      )
    );
  });

  it('reconnects: kills the old session and creates a new one', async () => {
    render(<PodTerminalModal isOpen {...baseProps} />);
    await waitFor(() =>
      expect(screen.getByTestId('terminal')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /reconnect/i }));

    await waitFor(() =>
      expect(window.electron.terminalKill).toHaveBeenCalledWith('sess-1')
    );
    expect(window.electron.terminalCreate).toHaveBeenCalledTimes(2);
  });

  it('kills the session when the modal closes', async () => {
    const { rerender } = render(<PodTerminalModal isOpen {...baseProps} />);
    await waitFor(() =>
      expect(screen.getByTestId('terminal')).toBeInTheDocument()
    );

    rerender(<PodTerminalModal isOpen={false} {...baseProps} />);

    await waitFor(() =>
      expect(window.electron.terminalKill).toHaveBeenCalledWith('sess-1')
    );
    expect(screen.queryByTestId('terminal')).not.toBeInTheDocument();
  });
});
