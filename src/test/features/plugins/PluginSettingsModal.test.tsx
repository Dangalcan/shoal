import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../utils';
import { createMockElectronAPI } from '../../utils/mocks';
import { PluginSettingsModal } from '../../../features/plugins/PluginSettingsModal';
import { makePlugin } from './plugin-fixtures';

const configurable = makePlugin({
  manifest: {
    id: 'watcher',
    name: 'Watcher',
    configuration: {
      title: 'Watcher options',
      properties: {
        endpoint: {
          type: 'string',
          label: 'Endpoint',
          placeholder: 'endpoint',
        },
        interval: { type: 'number', label: 'Interval', default: 30 },
      },
    },
  },
});

describe('PluginSettingsModal', () => {
  let api: ReturnType<typeof createMockElectronAPI>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    api = createMockElectronAPI({
      getPluginSettings: vi
        .fn()
        .mockResolvedValue({ success: true, data: { endpoint: 'https://a' } }),
    });
    onClose = vi.fn();
  });

  it('loads stored settings over the schema defaults and saves them', async () => {
    render(<PluginSettingsModal plugin={configurable} onClose={onClose} />, {
      api,
    });

    expect(screen.getByText('Settings: Watcher')).toBeInTheDocument();
    expect(await screen.findByPlaceholderText('endpoint')).toHaveValue(
      'https://a'
    );
    expect(screen.getByRole('spinbutton')).toHaveValue(30);

    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() =>
      expect(api.setPluginSettings).toHaveBeenCalledWith('watcher', {
        endpoint: 'https://a',
        interval: 30,
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the dialog open and shows why saving failed', async () => {
    api.setPluginSettings = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'read-only disk' });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    render(<PluginSettingsModal plugin={configurable} onClose={onClose} />, {
      api,
    });

    fireEvent.click(
      await screen.findByRole('button', { name: 'Save Settings' })
    );

    expect(await screen.findAllByText('read-only disk')).not.toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('says so when a plugin has nothing to configure', () => {
    render(<PluginSettingsModal plugin={makePlugin()} onClose={onClose} />, {
      api,
    });

    expect(
      screen.getByText('This plugin has no configurable settings.')
    ).toBeInTheDocument();
    expect(api.getPluginSettings).not.toHaveBeenCalled();
  });
});
