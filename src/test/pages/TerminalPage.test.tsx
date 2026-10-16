import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils';
import userEvent from '@testing-library/user-event';
import { createMockElectronAPI } from '../utils/mocks';
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

let api: ReturnType<typeof createMockElectronAPI>;

describe('TerminalPage', () => {
  beforeEach(() => {
    api = createMockElectronAPI({
      terminalShells: vi
        .fn()
        .mockResolvedValue({ success: true, data: shellsData }),
      terminalCreate: vi
        .fn()
        .mockResolvedValue({ success: true, data: { sessionId: 's1' } }),
      terminalKill: vi.fn().mockResolvedValue({ success: true, data: true }),
    });
  });

  it('creates a default-shell session and shows the shell badge', async () => {
    render(<TerminalPage />, { api });

    await waitFor(() => {
      expect(screen.getByTestId('terminal')).toBeInTheDocument();
    });

    expect(api.terminalCreate).toHaveBeenCalledWith({
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
    render(<TerminalPage />, { api });

    const select = await screen.findByLabelText('Shell type');
    const options = [...select.querySelectorAll('option')].map(
      (o) => o.textContent
    );
    expect(options).toEqual(['PowerShell', 'Command Prompt', 'WSL']);
    expect((select as HTMLSelectElement).value).toBe('powershell');
  });

  it('starts a new session with the picked shell and kills the old one', async () => {
    render(<TerminalPage />, { api });
    await screen.findByTestId('terminal');

    api.terminalCreate.mockResolvedValue({
      success: true,
      data: { sessionId: 's2', shellFamily: 'unix' },
    });

    const select = await screen.findByLabelText('Shell type');
    await userEvent.selectOptions(select, 'wsl');

    await waitFor(() => {
      expect(api.terminalCreate).toHaveBeenCalledWith({
        kind: 'local',
        shell: 'wsl',
      });
    });
    expect(api.terminalKill).toHaveBeenCalledWith('s1');
    await waitFor(() =>
      expect(screen.getByTestId('terminal')).toHaveAttribute(
        'data-session',
        's2'
      )
    );
    expect(screen.getByTestId('terminal')).toHaveAttribute(
      'data-family',
      'unix'
    );
    expect(
      document.querySelector('.terminal-page__session-badge')
    ).toHaveTextContent('WSL');
  });

  it('hides the picker when shell detection fails', async () => {
    api.terminalShells.mockResolvedValue({ success: false, error: 'boom' });

    render(<TerminalPage />, { api });
    await screen.findByTestId('terminal');

    expect(screen.queryByLabelText('Shell type')).not.toBeInTheDocument();
  });

  it('shows the error state and retries', async () => {
    api.terminalCreate
      .mockResolvedValueOnce({ success: false, error: 'spawn failed' })
      .mockResolvedValueOnce({
        success: true,
        data: { sessionId: 's3', shellFamily: 'windows' },
      });

    render(<TerminalPage />, { api });

    expect(await screen.findByText('spawn failed')).toBeInTheDocument();
    expect(
      document.querySelector('.terminal-page__session-badge')
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByTestId('terminal')).toHaveAttribute(
        'data-session',
        's3'
      );
    });
  });

  it('kills the active session on unmount', async () => {
    const { unmount } = render(<TerminalPage />, { api });
    await screen.findByTestId('terminal');

    unmount();

    expect(api.terminalKill).toHaveBeenCalledWith('s1');
  });
});
