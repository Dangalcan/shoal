/**
 * PluginSettingsModal against a stubbed plugin context, for the paths the real
 * provider never takes: its `getSettings` swallows failures and its
 * `saveSettings` always throws an Error, so rejected loads, non-Error
 * failures and loads that finish after the dialog is gone need a fake.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PluginSettingsModal } from '../../../features/plugins/PluginSettingsModal';
import { makePlugin } from './plugin-fixtures';

interface Deferred {
  promise: Promise<Record<string, unknown>>;
  resolve: (value: Record<string, unknown>) => void;
  reject: (reason: unknown) => void;
}

function deferred(): Deferred {
  let resolve!: Deferred['resolve'];
  let reject!: Deferred['reject'];
  const promise = new Promise<Record<string, unknown>>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const ctx = vi.hoisted(() => ({
  getSettings: vi.fn<(id: string) => Promise<Record<string, unknown>>>(),
  saveSettings:
    vi.fn<(id: string, settings: Record<string, unknown>) => Promise<void>>(),
}));

vi.mock('../../../features/plugins/PluginProvider', () => ({
  usePlugins: () => ({
    getSettings: ctx.getSettings,
    saveSettings: ctx.saveSettings,
  }),
}));

function configurable(id: string, name: string) {
  return makePlugin({
    manifest: {
      id,
      name,
      configuration: {
        title: `${name} options`,
        properties: {
          endpoint: {
            type: 'string',
            label: 'Endpoint',
            placeholder: 'endpoint',
          },
        },
      },
    },
  });
}

const watcher = configurable('watcher', 'Watcher');
const logs = configurable('logs', 'Logs');

describe('PluginSettingsModal (stubbed context)', () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onClose = vi.fn<() => void>();
    ctx.getSettings.mockReset();
    ctx.saveSettings.mockReset();
  });

  it.each([
    ['without properties', { title: 'Empty' }],
    ['with no properties', { title: 'Empty', properties: {} }],
  ])(
    'treats a configuration %s as no settings at all',
    (_case, configuration) => {
      // Used to throw "Cannot convert undefined or null to object".
      const bare = makePlugin({
        manifest: {
          id: 'bare',
          name: 'Bare',
          configuration: configuration as never,
        },
      });

      render(<PluginSettingsModal plugin={bare} onClose={onClose} />);

      expect(
        screen.getByText('This plugin has no configurable settings.')
      ).toBeInTheDocument();
      expect(ctx.getSettings).not.toHaveBeenCalled();
    }
  );

  it('shows why loading failed and still offers the form', async () => {
    ctx.getSettings.mockRejectedValue(new Error('settings file is corrupt'));

    render(<PluginSettingsModal plugin={watcher} onClose={onClose} />);

    expect(
      await screen.findByText('settings file is corrupt')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save Settings' })
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('endpoint')).toHaveValue('');
  });

  it('falls back to a generic message when loading fails with a non-Error', async () => {
    ctx.getSettings.mockRejectedValue('EACCES');

    render(<PluginSettingsModal plugin={watcher} onClose={onClose} />);

    expect(
      await screen.findByText('Failed to load settings')
    ).toBeInTheDocument();
  });

  it('ignores a load that finishes after switching to another plugin', async () => {
    const forWatcher = deferred();
    const forLogs = deferred();
    ctx.getSettings.mockImplementation((id) =>
      id === 'watcher' ? forWatcher.promise : forLogs.promise
    );

    const { rerender } = render(
      <PluginSettingsModal plugin={watcher} onClose={onClose} />
    );
    rerender(<PluginSettingsModal plugin={logs} onClose={onClose} />);

    forLogs.resolve({ endpoint: 'https://logs' });
    expect(await screen.findByPlaceholderText('endpoint')).toHaveValue(
      'https://logs'
    );

    // The first dialog's late answer must not reach the second one.
    forWatcher.resolve({ endpoint: 'https://watcher' });
    await forWatcher.promise;
    expect(screen.getByText('Settings: Logs')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('endpoint')).toHaveValue('https://logs');
  });

  it('ignores a load failure that arrives after switching to another plugin', async () => {
    const forWatcher = deferred();
    const forLogs = deferred();
    ctx.getSettings.mockImplementation((id) =>
      id === 'watcher' ? forWatcher.promise : forLogs.promise
    );

    const { rerender } = render(
      <PluginSettingsModal plugin={watcher} onClose={onClose} />
    );
    rerender(<PluginSettingsModal plugin={logs} onClose={onClose} />);

    forWatcher.reject(new Error('watcher settings unreadable'));
    await forWatcher.promise.catch(() => undefined);
    forLogs.resolve({});

    expect(
      await screen.findByRole('button', { name: 'Save Settings' })
    ).toBeInTheDocument();
    expect(
      screen.queryByText('watcher settings unreadable')
    ).not.toBeInTheDocument();
  });

  it('shows a generic message and stays open when saving fails with a non-Error', async () => {
    ctx.getSettings.mockResolvedValue({ endpoint: 'https://a' });
    ctx.saveSettings.mockRejectedValue('disk full');
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(<PluginSettingsModal plugin={watcher} onClose={onClose} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Save Settings' })
    );

    // Once in the dialog's alert, once in the form's own error line.
    expect(await screen.findAllByText('Failed to save settings')).toHaveLength(
      2
    );
    expect(ctx.saveSettings).toHaveBeenCalledWith('watcher', {
      endpoint: 'https://a',
    });
    expect(onClose).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
