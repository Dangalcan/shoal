/**
 * The Plugins page's confirm handlers act on the plugin picked for the
 * dialog. The real ConfirmModal renders nothing while closed, so this stub
 * keeps its confirm button on screen to check that confirming with no plugin
 * picked does nothing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../utils';
import { createMockElectronAPI } from '../utils/mocks';
import { mockToast } from '../mocks/toast-mock';
import { makePlugin } from '../features/plugins/plugin-fixtures';
import Plugins from '../../pages/Plugins';

vi.mock('../../components/modals/ConfirmModal', () => ({
  ConfirmModal: ({
    title,
    onConfirm,
  }: {
    title: string;
    onConfirm: () => void;
  }) => <button onClick={onConfirm}>{`Confirm: ${title}`}</button>,
}));

describe('Plugins page confirm handlers without a picked plugin', () => {
  let api: ReturnType<typeof createMockElectronAPI>;

  beforeEach(() => {
    api = createMockElectronAPI({
      getPlugins: vi.fn().mockResolvedValue({
        success: true,
        data: [
          makePlugin({
            state: 'enabled',
            hasUpdate: true,
            latestVersion: '2.0.0',
            licenseInfo: { isActive: true },
            manifest: { id: 'watcher', name: 'Watcher' },
          }),
        ],
      }),
    });
  });

  it.each([
    ['Uninstall Plugin', 'uninstallPlugin'],
    ['Update Plugin', 'installPlugin'],
    ['Deactivate License', 'deactivatePluginLicense'],
  ] as const)(
    'does nothing when "%s" is confirmed with no plugin picked',
    async (title, apiMethod) => {
      render(<Plugins />, { api });
      await screen.findByText('Watcher');

      fireEvent.click(
        screen.getByRole('button', { name: `Confirm: ${title}` })
      );

      expect(api[apiMethod]).not.toHaveBeenCalled();
      expect(api.disablePlugin).not.toHaveBeenCalled();
      expect(mockToast.loading).not.toHaveBeenCalled();
      expect(mockToast.error).not.toHaveBeenCalled();
    }
  );
});
