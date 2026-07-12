import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils';
import userEvent from '@testing-library/user-event';
import { PortForwards } from '../../pages/PortForwards';
import type { PortForwardInfo } from '../../types';

const forward: PortForwardInfo = {
  id: 'fwd-1',
  contextName: 'kind-test',
  namespace: 'default',
  resourceType: 'service',
  resourceName: 'my-svc',
  localPort: 8080,
  remotePort: 80,
  startedAt: '2026-01-01T00:00:00.000Z',
};

describe('PortForwards page', () => {
  beforeEach(() => {
    window.electron.portForwardList = vi
      .fn()
      .mockResolvedValue({ success: true, data: [forward] });
    window.electron.portForwardStop = vi
      .fn()
      .mockResolvedValue({ success: true, data: true });
    window.electron.onPortForwardClosed = vi.fn().mockReturnValue(() => {});
    window.electron.openExternal = vi
      .fn()
      .mockResolvedValue({ success: true, data: true });
  });

  it('lists active forwards', async () => {
    render(<PortForwards />);

    expect(await screen.findByText('service/my-svc')).toBeInTheDocument();
    expect(screen.getByText('localhost:8080 → 80')).toBeInTheDocument();
    expect(screen.getByText('kind-test')).toBeInTheDocument();
    expect(screen.getByText('1 active')).toBeInTheDocument();
  });

  it('shows the empty state when nothing is forwarded', async () => {
    window.electron.portForwardList = vi
      .fn()
      .mockResolvedValue({ success: true, data: [] });

    render(<PortForwards />);

    expect(
      await screen.findByText('No active port forwards')
    ).toBeInTheDocument();
  });

  it('shows the error state and retries', async () => {
    window.electron.portForwardList = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: 'boom' })
      .mockResolvedValueOnce({ success: true, data: [forward] });

    render(<PortForwards />);

    expect(await screen.findByText('boom')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Retry'));
    expect(await screen.findByText('service/my-svc')).toBeInTheDocument();
  });

  it('stops a forward and refreshes the list', async () => {
    render(<PortForwards />);
    await screen.findByText('service/my-svc');

    window.electron.portForwardList = vi
      .fn()
      .mockResolvedValue({ success: true, data: [] });

    await userEvent.click(screen.getByTitle('Stop forward'));

    expect(window.electron.portForwardStop).toHaveBeenCalledWith('fwd-1');
    expect(
      await screen.findByText('No active port forwards')
    ).toBeInTheDocument();
  });

  it('opens the tunnel in the browser', async () => {
    render(<PortForwards />);
    await screen.findByText('service/my-svc');

    await userEvent.click(screen.getByTitle('Open http://localhost:8080'));

    expect(window.electron.openExternal).toHaveBeenCalledWith(
      'http://localhost:8080'
    );
  });

  it('refetches when the backend reports a closed tunnel', async () => {
    let closedCb: ((info: PortForwardInfo, error?: string) => void) | null =
      null;
    window.electron.onPortForwardClosed = vi.fn((cb) => {
      closedCb = cb;
      return () => {};
    });

    render(<PortForwards />);
    await screen.findByText('service/my-svc');

    window.electron.portForwardList = vi
      .fn()
      .mockResolvedValue({ success: true, data: [] });
    closedCb!(forward, 'pod deleted');

    await waitFor(() => {
      expect(screen.getByText('No active port forwards')).toBeInTheDocument();
    });
  });
});
