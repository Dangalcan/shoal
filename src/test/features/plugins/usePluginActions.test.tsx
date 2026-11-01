import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { ApiProvider } from '../../../services/api-context';
import { createMockElectronAPI } from '../../utils/mocks';
import { mockToast } from '../../mocks/toast-mock';
import { usePluginActions } from '../../../features/plugins/usePluginActions';
import { makePlugin } from './plugin-fixtures';

describe('usePluginActions', () => {
  let api: ReturnType<typeof createMockElectronAPI>;
  let refreshPlugins: ReturnType<typeof vi.fn<() => Promise<void>>>;

  beforeEach(() => {
    api = createMockElectronAPI();
    refreshPlugins = vi.fn<() => Promise<void>>().mockResolvedValue();
  });

  function setup(plugins = [makePlugin()]) {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApiProvider api={api}>{children}</ApiProvider>
    );
    return renderHook(() => usePluginActions(plugins, refreshPlugins), {
      wrapper,
    }).result.current;
  }

  describe('disablePlugin', () => {
    it('rejects with a default message when the failure carries none', async () => {
      api.disablePlugin.mockResolvedValue({ success: false } as never);
      const actions = setup();

      await expect(actions.disablePlugin('p1')).rejects.toThrow(
        'Failed to disable plugin'
      );
      expect(refreshPlugins).not.toHaveBeenCalled();
    });

    it('rejects with the error the main process returned', async () => {
      api.disablePlugin.mockResolvedValue({
        success: false,
        error: 'plugin is busy',
      } as never);
      const actions = setup();

      await expect(actions.disablePlugin('p1')).rejects.toThrow(
        'plugin is busy'
      );
    });

    it('treats a missing cascade list as no cascade', async () => {
      api.disablePlugin.mockResolvedValue({ success: true } as never);
      const actions = setup();

      await actions.disablePlugin('p1');

      expect(api.disablePlugin).toHaveBeenCalledWith('p1');
      expect(refreshPlugins).toHaveBeenCalledTimes(1);
      expect(mockToast.warning).not.toHaveBeenCalled();
    });

    it('names the cascaded plugins it knows and falls back to the id', async () => {
      api.disablePlugin.mockResolvedValue({
        success: true,
        data: ['p1', 'ghost'],
      } as never);
      const actions = setup([makePlugin()]);

      await actions.disablePlugin('base');

      expect(mockToast.warning).toHaveBeenCalledWith(
        'Also disabled: Plugin One, ghost',
        { description: 'These plugins depended on the one you disabled.' }
      );
    });
  });

  describe('getPluginExtensions', () => {
    it.each([
      ['an Error', new Error('ipc closed'), 'ipc closed'],
      ['a non-Error', 'ipc closed', undefined],
    ])(
      'toasts and returns no extensions when the call throws %s',
      async (_label, thrown, description) => {
        api.getPluginExtensions.mockRejectedValue(thrown);
        const actions = setup();

        await expect(actions.getPluginExtensions('dashboard')).resolves.toEqual(
          []
        );
        expect(mockToast.error).toHaveBeenCalledWith(
          'Failed to load plugin extensions',
          { description }
        );
      }
    );
  });

  describe('getSettings', () => {
    it.each([
      ['an Error', new Error('store locked'), 'store locked'],
      ['a non-Error', 'store locked', undefined],
    ])(
      'toasts and returns empty settings when the call throws %s',
      async (_label, thrown, description) => {
        api.getPluginSettings.mockRejectedValue(thrown);
        const actions = setup();

        await expect(actions.getSettings('p1')).resolves.toEqual({});
        expect(mockToast.error).toHaveBeenCalledWith(
          'Failed to load plugin settings',
          { description }
        );
      }
    );
  });

  describe('checkForUpdates', () => {
    it.each([
      ['an Error', new Error('offline'), 'offline'],
      ['a non-Error', 'offline', undefined],
    ])(
      'toasts and skips the refresh when the call throws %s',
      async (_label, thrown, description) => {
        api.checkForPluginUpdates.mockRejectedValue(thrown);
        const actions = setup();

        await expect(actions.checkForUpdates()).resolves.toBeUndefined();
        expect(mockToast.error).toHaveBeenCalledWith(
          'Failed to check for plugin updates',
          { description }
        );
        expect(refreshPlugins).not.toHaveBeenCalled();
      }
    );
  });
});
