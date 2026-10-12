import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../utils';
import { createMockElectronAPI } from '../../utils/mocks';
import { AboutCard } from '../../../features/settings/AboutCard';
import { toast } from 'sonner';
import type { UpdateStatus } from '../../../types.d';

vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('AboutCard', () => {
  let api: ReturnType<typeof createMockElectronAPI>;
  let emitStatus: (status: UpdateStatus) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    api = createMockElectronAPI();
    api.onUpdateStatus = vi.fn((cb: (s: UpdateStatus) => void) => {
      emitStatus = cb;
      return () => {};
    });
  });

  it('shows the version and platform', async () => {
    render(<AboutCard />, { api });
    expect(await screen.findByText(/Shoal v1\.0\.0-test/)).toBeInTheDocument();
    expect(screen.getByText(/linux x64/)).toBeInTheDocument();
  });

  it('confirms when a manual check finds no update', async () => {
    api.checkForAppUpdates = vi
      .fn()
      .mockResolvedValue({ success: true, data: 'started' });
    render(<AboutCard />, { api });

    fireEvent.click(screen.getByText('Check for updates'));
    await waitFor(() => expect(api.checkForAppUpdates).toHaveBeenCalled());
    emitStatus({ state: 'checking' });
    emitStatus({ state: 'not-available' });

    expect(toast.success).toHaveBeenCalledWith('You are on the latest version');
  });

  it('explains when the build cannot update itself', async () => {
    api.checkForAppUpdates = vi
      .fn()
      .mockResolvedValue({ success: true, data: 'portable' });
    render(<AboutCard />, { api });

    fireEvent.click(screen.getByText('Check for updates'));

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith(
        'This build cannot update itself',
        expect.anything()
      )
    );
  });

  it('does not call a failed check "portable"', async () => {
    api.checkForAppUpdates = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'bridge down' });
    render(<AboutCard />, { api });

    fireEvent.click(screen.getByText('Check for updates'));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Could not check for updates', {
        description: 'bridge down',
      })
    );
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('says that development builds do not check for updates', async () => {
    api.checkForAppUpdates = vi
      .fn()
      .mockResolvedValue({ success: true, data: 'dev' });
    render(<AboutCard />, { api });

    fireEvent.click(screen.getByText('Check for updates'));

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith(
        'Update checks only run in installed builds'
      )
    );
  });

  it('ignores update statuses it did not ask for', async () => {
    render(<AboutCard />, { api });
    await screen.findByText(/Shoal v1\.0\.0-test/);
    emitStatus({ state: 'not-available' });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('opens the logs folder and reports failures', async () => {
    api.openLogsFolder = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'No file manager' });
    render(<AboutCard />, { api });

    fireEvent.click(screen.getByText('Open logs folder'));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Could not open the logs folder',
        { description: 'No file manager' }
      )
    );
  });

  it('opens a prefilled GitHub issue', async () => {
    render(<AboutCard />, { api });
    await screen.findByText(/Shoal v1\.0\.0-test/);

    fireEvent.click(screen.getByText('Report a problem'));

    const url = new URL(String(vi.mocked(api.openExternal).mock.calls[0]?.[0]));
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://github.com/Dangalcan/shoal/issues/new'
    );
    expect(url.searchParams.get('template')).toBe('bug_report.yml');
    expect(url.searchParams.get('version')).toBe('v1.0.0-test');
  });
});
