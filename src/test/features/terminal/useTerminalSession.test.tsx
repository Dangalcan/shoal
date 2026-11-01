import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ApiProvider } from '../../../services/api-context';
import { createMockElectronAPI } from '../../utils/mocks';
import {
  useTerminalSession,
  type TerminalCreateArgs,
} from '../../../features/terminal/useTerminalSession';

/**
 * One terminal session per set of arguments: created on mount, replaced
 * when the arguments or the attempt change, killed on unmount, and never
 * leaked when the answer arrives after the owner moved on.
 */
describe('useTerminalSession', () => {
  let api: ReturnType<typeof createMockElectronAPI>;
  let nextId: number;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider api={api}>{children}</ApiProvider>
  );

  const renderSession = (args: TerminalCreateArgs, attempt = 0) =>
    renderHook(
      (props: { args: TerminalCreateArgs; attempt: number }) =>
        useTerminalSession(props.args, props.attempt),
      { wrapper, initialProps: { args, attempt } }
    );

  beforeEach(() => {
    nextId = 0;
    api = createMockElectronAPI({
      terminalCreate: vi.fn().mockImplementation(async () => ({
        success: true,
        data: { sessionId: `s${++nextId}`, shellFamily: 'unix' },
      })),
      terminalKill: vi.fn().mockResolvedValue({ success: true, data: true }),
    });
  });

  it('creates the session on mount and reports it', async () => {
    const { result } = renderSession({ kind: 'local', shell: 'bash' });
    expect(result.current).toEqual({
      sessionId: null,
      shellFamily: null,
      transport: 'pipe',
      windowsPty: undefined,
      loading: true,
      error: null,
    });

    await waitFor(() => expect(result.current.sessionId).toBe('s1'));
    expect(result.current.shellFamily).toBe('unix');
    // No transport in the answer (older main process): pipe behaviour.
    expect(result.current.transport).toBe('pipe');
    expect(result.current.windowsPty).toBeUndefined();
    expect(result.current.loading).toBe(false);
    expect(api.terminalCreate).toHaveBeenCalledWith({
      kind: 'local',
      shell: 'bash',
    });
  });

  it('reports the pseudo-terminal behind the session', async () => {
    api.terminalCreate.mockResolvedValue({
      success: true,
      data: {
        sessionId: 's1',
        shellFamily: 'windows',
        transport: 'pty',
        windowsPty: { backend: 'conpty', buildNumber: 22631 },
      },
    });
    const { result } = renderSession({ kind: 'local' });

    await waitFor(() => expect(result.current.sessionId).toBe('s1'));
    expect(result.current.transport).toBe('pty');
    expect(result.current.windowsPty).toEqual({
      backend: 'conpty',
      buildNumber: 22631,
    });
  });

  it('reports why the session could not start', async () => {
    api.terminalCreate.mockResolvedValue({
      success: false,
      error: 'no such shell',
    });
    const { result } = renderSession({ kind: 'local' });

    await waitFor(() => expect(result.current.error).toBe('no such shell'));
    expect(result.current.sessionId).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('replaces the session when the arguments change, killing the old one', async () => {
    const { result, rerender } = renderSession({ kind: 'local', shell: 'a' });
    await waitFor(() => expect(result.current.sessionId).toBe('s1'));

    rerender({ args: { kind: 'local', shell: 'b' }, attempt: 0 });
    expect(result.current.loading).toBe(true);
    expect(result.current.sessionId).toBeNull();
    expect(api.terminalKill).toHaveBeenCalledWith('s1');

    await waitFor(() => expect(result.current.sessionId).toBe('s2'));
  });

  it('keeps the session when the same arguments arrive as a new object', async () => {
    const { result, rerender } = renderSession({ kind: 'local', shell: 'a' });
    await waitFor(() => expect(result.current.sessionId).toBe('s1'));

    rerender({ args: { kind: 'local', shell: 'a' }, attempt: 0 });

    expect(result.current.sessionId).toBe('s1');
    expect(api.terminalCreate).toHaveBeenCalledTimes(1);
    expect(api.terminalKill).not.toHaveBeenCalled();
  });

  it('starts over on a new attempt', async () => {
    const { result, rerender } = renderSession({ kind: 'local' });
    await waitFor(() => expect(result.current.sessionId).toBe('s1'));

    rerender({ args: { kind: 'local' }, attempt: 1 });

    await waitFor(() => expect(result.current.sessionId).toBe('s2'));
    expect(api.terminalKill).toHaveBeenCalledWith('s1');
  });

  it('kills the session on unmount', async () => {
    const { result, unmount } = renderSession({ kind: 'local' });
    await waitFor(() => expect(result.current.sessionId).toBe('s1'));

    unmount();

    expect(api.terminalKill).toHaveBeenCalledWith('s1');
  });

  it('kills a session whose answer arrives after the owner moved on', async () => {
    let finish: (v: any) => void = () => {};
    api.terminalCreate.mockImplementationOnce(
      () =>
        new Promise<any>((resolve) => {
          finish = resolve;
        })
    );
    const { result, rerender } = renderSession({ kind: 'local', shell: 'a' });

    rerender({ args: { kind: 'local', shell: 'b' }, attempt: 0 });
    await waitFor(() => expect(result.current.sessionId).toBe('s1'));

    finish({ success: true, data: { sessionId: 'late', shellFamily: 'unix' } });
    await waitFor(() => expect(api.terminalKill).toHaveBeenCalledWith('late'));
    expect(result.current.sessionId).toBe('s1');
  });

  it('has nothing to kill when a late answer is a failure', async () => {
    let finish: (v: any) => void = () => {};
    api.terminalCreate.mockImplementationOnce(
      () =>
        new Promise<any>((resolve) => {
          finish = resolve;
        })
    );
    const { result, unmount } = renderSession({ kind: 'local', shell: 'a' });
    expect(result.current.loading).toBe(true);

    unmount();
    await act(async () => {
      finish({ success: false, error: 'shell not found' });
    });

    expect(api.terminalKill).not.toHaveBeenCalled();
  });
});
