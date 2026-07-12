import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import { registerTerminalIpcHandlers } from '../ipc/terminal-ipc';
import {
  resolveLocalShell,
  getTerminalCwd,
} from '../services/terminal/local-shells';

vi.mock('../logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Stub the two functions the modules under test pull from child_process:
// terminal-ipc uses spawn; safe-exec (via ipc-utils) promisifies execFile.
vi.mock('child_process', () => {
  const spawn = vi.fn();
  const execFile = vi.fn();
  return { spawn, execFile, default: { spawn, execFile } };
});

vi.mock('../services/terminal/local-shells', () => ({
  getLocalShells: vi.fn(() => [
    { id: 'powershell', label: 'PowerShell', family: 'windows' },
    { id: 'cmd', label: 'Command Prompt', family: 'windows' },
  ]),
  getDefaultShellId: vi.fn(() => 'powershell'),
  resolveLocalShell: vi.fn((id?: string) => {
    if (id && id !== 'powershell' && id !== 'cmd') {
      throw new Error(`Unknown or unavailable shell: ${id}`);
    }
    return id === 'cmd'
      ? {
          id: 'cmd',
          label: 'Command Prompt',
          family: 'windows',
          file: 'cmd.exe',
          args: [],
        }
      : {
          id: 'powershell',
          label: 'PowerShell',
          family: 'windows',
          file: 'powershell.exe',
          args: ['-NoLogo'],
        };
  }),
  getTerminalCwd: vi.fn(() => '/tmp/kubernetes-desktop-terminal'),
}));

type IpcHandler = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

function makeFakeChild() {
  return {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    stdin: { write: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
    pid: 1234,
  };
}

const mockEvent = {
  sender: {
    isDestroyed: () => false,
    send: vi.fn(),
  },
} as unknown as IpcMainInvokeEvent;

function getHandler(channel: string): IpcHandler {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as IpcHandler;
}

describe('terminal-ipc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(spawn).mockReturnValue(
      makeFakeChild() as unknown as ReturnType<typeof spawn>
    );
    registerTerminalIpcHandlers();
  });

  describe('terminal:create (local)', () => {
    it('spawns the default shell in the temp cwd', async () => {
      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'local',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('sessionId');
      expect(resolveLocalShell).toHaveBeenCalledWith(undefined);
      expect(getTerminalCwd).toHaveBeenCalled();
      expect(spawn).toHaveBeenCalledWith(
        'powershell.exe',
        ['-NoLogo'],
        expect.objectContaining({ cwd: '/tmp/kubernetes-desktop-terminal' })
      );
    });

    it('spawns the requested shell from the allowlist', async () => {
      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'local',
        shell: 'cmd',
      });

      expect(result.success).toBe(true);
      expect(resolveLocalShell).toHaveBeenCalledWith('cmd');
      expect(spawn).toHaveBeenCalledWith(
        'cmd.exe',
        [],
        expect.objectContaining({ cwd: '/tmp/kubernetes-desktop-terminal' })
      );
    });

    it('rejects shells outside the allowlist without spawning', async () => {
      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'local',
        shell: 'C:\\evil.exe',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Unknown or unavailable shell/);
      expect(spawn).not.toHaveBeenCalled();
    });
  });

  describe('terminal:create (pod-exec)', () => {
    it('spawns kubectl exec through cmd.exe without a temp cwd', async () => {
      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'pod-exec',
        podName: 'my-pod',
        namespace: 'default',
        contextName: 'kind-test',
      });

      expect(result.success).toBe(true);
      expect(getTerminalCwd).not.toHaveBeenCalled();
      expect(spawn).toHaveBeenCalledWith(
        'cmd.exe',
        expect.arrayContaining(['kubectl', 'exec', 'my-pod']),
        expect.objectContaining({ cwd: undefined })
      );
    });

    it('fails when pod-exec args are missing', async () => {
      const result = await getHandler('terminal:create')(mockEvent, {
        kind: 'pod-exec',
        podName: 'my-pod',
      });

      expect(result.success).toBe(false);
      expect(spawn).not.toHaveBeenCalled();
    });
  });

  describe('terminal:shells', () => {
    it('returns the detected shells and the default id', async () => {
      const result = await getHandler('terminal:shells')(mockEvent);

      expect(result).toEqual({
        success: true,
        data: {
          shells: [
            { id: 'powershell', label: 'PowerShell', family: 'windows' },
            { id: 'cmd', label: 'Command Prompt', family: 'windows' },
          ],
          defaultShell: 'powershell',
        },
      });
    });
  });
});
