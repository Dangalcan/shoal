import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../utils';
import { createMockElectronAPI } from '../../utils/mocks';
import { KubectlMissingNotice } from '../../../features/clusters/KubectlMissingNotice';

/**
 * The notice shown when kubectl is not on the PATH: nothing while probing or
 * when installed, otherwise the install link and a re-check that also tells
 * the parent.
 */

describe('KubectlMissingNotice', () => {
  let api: ReturnType<typeof createMockElectronAPI>;

  beforeEach(() => {
    api = createMockElectronAPI();
  });

  function toolStatus(installed: boolean) {
    api.getToolStatus.mockResolvedValue({
      success: true,
      data: { tool: 'kubectl', installed, version: installed ? '1.31' : '' },
    });
  }

  it('renders nothing when kubectl is installed', async () => {
    toolStatus(true);
    const { container } = render(<KubectlMissingNotice />, { api });

    await waitFor(() => expect(api.getToolStatus).toHaveBeenCalled());
    expect(container.querySelector('.tool-missing')).toBeNull();
  });

  it('offers the install page and a re-check when kubectl is missing', async () => {
    toolStatus(false);
    const onRecheck = vi.fn().mockResolvedValue(undefined);
    render(<KubectlMissingNotice onRecheck={onRecheck} />, { api });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('kubectl not found');

    fireEvent.click(
      screen.getByRole('button', { name: /Install instructions/ })
    );
    expect(api.openExternal).toHaveBeenCalledWith(
      'https://kubernetes.io/docs/tasks/tools/'
    );

    api.getToolStatus.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Check again/ }));
    await waitFor(() => expect(api.getToolStatus).toHaveBeenCalled());
    await waitFor(() => expect(onRecheck).toHaveBeenCalledTimes(1));
  });
});
