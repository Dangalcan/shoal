import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../utils';
import userEvent from '@testing-library/user-event';
import { PortForwardModal } from '../../../components/modals/PortForwardModal';

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  contextName: 'kind-test',
  namespace: 'default',
  resourceType: 'service' as const,
  resourceName: 'my-svc',
};

describe('PortForwardModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.electron.portForwardStart = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'fwd-1' },
    });
  });

  it('prefills both ports from the first suggested port', () => {
    render(<PortForwardModal {...baseProps} suggestedPorts={[80, 443]} />);

    const [remote, local] = screen.getAllByRole('spinbutton');
    expect(remote).toHaveValue(80);
    expect(local).toHaveValue(80);
    expect(screen.getByRole('button', { name: '443' })).toBeInTheDocument();
  });

  it('keeps local port in sync with remote until edited', async () => {
    render(<PortForwardModal {...baseProps} suggestedPorts={[80, 443]} />);
    const [, local] = screen.getAllByRole('spinbutton');

    await userEvent.click(screen.getByRole('button', { name: '443' }));
    expect(local).toHaveValue(443);

    await userEvent.clear(local!);
    await userEvent.type(local!, '9000');
    await userEvent.click(screen.getByRole('button', { name: '80' }));
    expect(local).toHaveValue(9000);
  });

  it('starts the forward and closes on success', async () => {
    render(<PortForwardModal {...baseProps} suggestedPorts={[80]} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Start Forward' })
    );

    await waitFor(() => {
      expect(window.electron.portForwardStart).toHaveBeenCalledWith({
        contextName: 'kind-test',
        namespace: 'default',
        resourceType: 'service',
        resourceName: 'my-svc',
        localPort: 80,
        remotePort: 80,
      });
    });
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('stays open when the start fails', async () => {
    window.electron.portForwardStart = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'port busy' });

    render(<PortForwardModal {...baseProps} suggestedPorts={[80]} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Start Forward' })
    );

    await waitFor(() => {
      expect(window.electron.portForwardStart).toHaveBeenCalled();
    });
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it('disables Start until both ports are valid', async () => {
    render(<PortForwardModal {...baseProps} />);

    const start = screen.getByRole('button', { name: 'Start Forward' });
    expect(start).toBeDisabled();

    const [remote] = screen.getAllByRole('spinbutton');
    await userEvent.type(remote!, '80');
    expect(start).toBeEnabled();

    await userEvent.clear(remote!);
    await userEvent.type(remote!, '99999');
    expect(start).toBeDisabled();
  });
});
