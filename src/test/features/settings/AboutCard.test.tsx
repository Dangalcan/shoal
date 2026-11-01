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

  it('opens the logs folder without a toast when it works', async () => {
    render(<AboutCard />, { api });

    fireEvent.click(screen.getByText('Open logs folder'));

    await waitFor(() => expect(api.openLogsFolder).toHaveBeenCalledTimes(1));
    expect(toast.error).not.toHaveBeenCalled();
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

  it('reports an update check that fails after it started', async () => {
    api.checkForAppUpdates = vi
      .fn()
      .mockResolvedValue({ success: true, data: 'started' });
    render(<AboutCard />, { api });

    fireEvent.click(screen.getByText('Check for updates'));
    await waitFor(() => expect(api.checkForAppUpdates).toHaveBeenCalled());
    emitStatus({ state: 'downloading', percent: 10 });
    emitStatus({ state: 'error', message: 'feed unreachable' });

    expect(toast.error).toHaveBeenCalledWith('Could not check for updates', {
      description: 'feed unreachable',
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('leaves a found update to the update notifier', async () => {
    api.checkForAppUpdates = vi
      .fn()
      .mockResolvedValue({ success: true, data: 'started' });
    render(<AboutCard />, { api });

    fireEvent.click(screen.getByText('Check for updates'));
    await waitFor(() => expect(api.checkForAppUpdates).toHaveBeenCalled());
    emitStatus({ state: 'available', version: '2.0.0' });
    // The check is over: later statuses are not answered.
    emitStatus({ state: 'not-available' });

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('explains that a package install updates through its package manager', async () => {
    api.checkForAppUpdates = vi
      .fn()
      .mockResolvedValue({ success: true, data: 'package' });
    render(<AboutCard />, { api });

    fireEvent.click(screen.getByText('Check for updates'));

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith(
        'This build cannot update itself',
        {
          description:
            'Installed from a package: update it with your package manager or download the new release.',
        }
      )
    );
  });

  it('stays silent when a check answers with an error the updater reports', async () => {
    api.checkForAppUpdates = vi
      .fn()
      .mockResolvedValue({ success: true, data: 'error' });
    render(<AboutCard />, { api });

    fireEvent.click(screen.getByText('Check for updates'));

    await waitFor(() => expect(api.checkForAppUpdates).toHaveBeenCalled());
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('works without an update status channel', async () => {
    const withoutStatus = createMockElectronAPI();
    // An older preload exposes no update status events.
    Reflect.deleteProperty(withoutStatus, 'onUpdateStatus');
    withoutStatus.checkForAppUpdates = vi
      .fn()
      .mockResolvedValue({ success: true, data: 'dev' });
    render(<AboutCard />, { api: withoutStatus });

    expect(await screen.findByText(/Shoal v1\.0\.0-test/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Check for updates'));

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith(
        'Update checks only run in installed builds'
      )
    );
  });
});
