import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useToolStatus, TOOL_INSTALL_URLS } from '../../hooks/useToolStatus';
import { ApiProvider } from '../../services/api-context';
import { createMockElectronAPI } from '../utils/mocks';

function renderToolStatus(
  api: ReturnType<typeof createMockElectronAPI>,
  tool = 'kubectl'
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider api={api}>{children}</ApiProvider>
  );
  return renderHook(({ name }: { name: string }) => useToolStatus(name), {
    wrapper,
    initialProps: { name: tool },
  });
}

describe('useToolStatus', () => {
  it('is checking, and not missing, while the first probe runs', () => {
    const api = createMockElectronAPI({
      getToolStatus: vi.fn(() => new Promise(() => {})),
    });
    const { result } = renderToolStatus(api);

    expect(result.current.checking).toBe(true);
    expect(result.current.status).toBeNull();
    expect(result.current.missing).toBe(false);
  });

  it('reports an installed tool as present', async () => {
    const api = createMockElectronAPI();
    const { result } = renderToolStatus(api, 'helm');

    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(api.getToolStatus).toHaveBeenCalledWith('helm');
    expect(result.current.status).toEqual(
      expect.objectContaining({ tool: 'helm', installed: true })
    );
    expect(result.current.missing).toBe(false);
  });

  it('reports a tool that is not installed as missing', async () => {
    const api = createMockElectronAPI({
      getToolStatus: vi.fn().mockResolvedValue({
        success: true,
        data: { tool: 'kubectl', installed: false },
      }),
    });
    const { result } = renderToolStatus(api);

    await waitFor(() => expect(result.current.missing).toBe(true));
    expect(result.current.checking).toBe(false);
  });

  it('does not call a failed probe missing', async () => {
    const api = createMockElectronAPI({
      getToolStatus: vi.fn().mockResolvedValue({
        success: false,
        error: 'probe failed',
      }),
    });
    const { result } = renderToolStatus(api);

    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.status).toBeNull();
    expect(result.current.missing).toBe(false);
  });

  it('probes again on recheck and when the tool changes', async () => {
    const getToolStatus = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: { tool: 'kubectl', installed: false },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { tool: 'kubectl', installed: true, version: 'v1.31' },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { tool: 'kind', installed: true },
      });
    const api = createMockElectronAPI({ getToolStatus });
    const { result, rerender } = renderToolStatus(api);
    await waitFor(() => expect(result.current.missing).toBe(true));

    await act(async () => {
      await result.current.recheck();
    });
    expect(result.current.missing).toBe(false);
    expect(result.current.status?.version).toBe('v1.31');

    rerender({ name: 'kind' });
    await waitFor(() => expect(result.current.status?.tool).toBe('kind'));
    expect(getToolStatus).toHaveBeenLastCalledWith('kind');
  });

  it('links an install guide for every detected tool', () => {
    for (const tool of [
      'kubectl',
      'helm',
      'kind',
      'k3d',
      'docker',
      'podman',
      'kompose',
    ]) {
      expect(TOOL_INSTALL_URLS[tool]).toMatch(/^https:\/\//);
    }
  });
});
