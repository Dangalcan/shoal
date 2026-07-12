import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils';
import userEvent from '@testing-library/user-event';
import { TerminalPage } from '../../pages/TerminalPage';

vi.mock('../../components/Terminal', () => ({
  Terminal: ({
    sessionId,
    shellFamily,
  }: {
    sessionId: string;
    shellFamily?: string;
  }) => (
    <div
      data-testid="terminal"
      data-session={sessionId}
      data-family={shellFamily}
    />
  ),
}));

const shellsData = {
  shells: [
    { id: 'powershell', label: 'PowerShell', family: 'windows' },
    { id: 'cmd', label: 'Command Prompt', family: 'windows' },
    { id: 'wsl', label: 'WSL', family: 'unix' },
  ],
  defaultShell: 'powershell',
};

describe('TerminalPage', () => {
  beforeEach(() => {
    window.electron.terminalShells = vi
      .fn()
      .mockResolvedValue({ success: true, data: shellsData });
    window.electron.terminalCreate = vi
      .fn()
      .mockResolvedValue({ success: true, data: { sessionId: 's1' } });
    window.electron.terminalKill = vi
      .fn()
      .mockResolvedValue({ success: true, data: true });
  });

  it('creates a default-shell session and shows the shell badge', async () => {
    render(<TerminalPage />);

    await waitFor(() => {
      expect(screen.getByTestId('terminal')).toBeInTheDocument();
    });

    expect(window.electron.terminalCreate).toHaveBeenCalledWith({
      kind: 'local',
      shell: undefined,
    });
    expect(
      document.querySelector('.terminal-page__session-badge')
    ).toHaveTextContent('PowerShell');
    expect(screen.getByTestId('terminal')).toHaveAttribute(
      'data-family',
      'windows'
    );
  });

  it('lists detected shells in the picker', async () => {
    render(<TerminalPage />);

    const select = await screen.findByLabelText('Shell type');
    const options = [...select.querySelectorAll('option')].map(
      (o) => o.textContent
    );
    expect(options).toEqual(['PowerShell', 'Command Prompt', 'WSL']);
    expect((select as HTMLSelectElement).value).toBe('powershell');
  });

  it('starts a new session with the picked shell and kills the old one', async () => {
    render(<TerminalPage />);
    await screen.findByTestId('terminal');

    window.electron.terminalCreate = vi
      .fn()
      .mockResolvedValue({ success: true, data: { sessionId: 's2' } });

    const select = await screen.findByLabelText('Shell type');
    await userEvent.selectOptions(select, 'wsl');

    await waitFor(() => {
      expect(window.electron.terminalCreate).toHaveBeenCalledWith({
        kind: 'local',
        shell: 'wsl',
      });
    });
    expect(window.electron.terminalKill).toHaveBeenCalledWith('s1');
    expect(screen.getByTestId('terminal')).toHaveAttribute(
      'data-family',
      'unix'
    );
    expect(
      document.querySelector('.terminal-page__session-badge')
    ).toHaveTextContent('WSL');
  });

  it('hides the picker when shell detection fails', async () => {
    window.electron.terminalShells = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'boom' });

    render(<TerminalPage />);
    await screen.findByTestId('terminal');

    expect(screen.queryByLabelText('Shell type')).not.toBeInTheDocument();
  });

  it('shows the error state and retries', async () => {
    window.electron.terminalCreate = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: 'spawn failed' })
      .mockResolvedValueOnce({ success: true, data: { sessionId: 's3' } });

    render(<TerminalPage />);

    expect(await screen.findByText('spawn failed')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByTestId('terminal')).toHaveAttribute(
        'data-session',
        's3'
      );
    });
  });

  it('kills the active session on unmount', async () => {
    const { unmount } = render(<TerminalPage />);
    await screen.findByTestId('terminal');

    unmount();

    expect(window.electron.terminalKill).toHaveBeenCalledWith('s1');
  });
});
