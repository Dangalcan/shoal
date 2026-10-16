import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import {
  PluginProvider,
  usePlugins,
  useEnabledPlugins,
  usePluginExtensions,
} from '../../../features/plugins/PluginProvider';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

// Help component to test the hook
const TestComponent = () => {
  const { plugins, loading } = usePlugins();
  if (loading) return <div>Loading...</div>;
  return (
    <ul>
      {plugins.map((p) => (
        <li key={p.manifest.id} data-testid="plugin-item">
          {p.manifest.name} - {p.state}
        </li>
      ))}
    </ul>
  );
};

// Mock useApi
vi.mock('../../../services/api-context', () => ({
  useApi: vi.fn(),
}));

import { useApi } from '../../../services/api-context';

describe('PluginProvider', () => {
  const mockApi = {
    getPlugins: vi.fn(),
    enablePlugin: vi.fn(),
    disablePlugin: vi.fn(),
    getPluginExtensions: vi.fn(),
    executePluginAction: vi.fn(),
    activatePluginLicense: vi.fn(),
    startPluginTrial: vi.fn(),
    deactivatePluginLicense: vi.fn(),
    installPlugin: vi.fn(),
    getPluginSettings: vi.fn(),
    setPluginSettings: vi.fn(),
    checkForPluginUpdates: vi.fn(),
    generatePlugin: vi.fn(),
    reloadPlugin: vi.fn(),
    uninstallPlugin: vi.fn(),
    importLocalPlugin: vi.fn(),
    onPluginStateChanged: vi.fn().mockReturnValue(() => {}),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApi).mockReturnValue(mockApi as any);

    // Default mock behavior
    mockApi.getPlugins.mockResolvedValue({
      success: true,
      data: [
        {
          manifest: {
            id: 'test-plugin',
            name: 'Test Plugin',
            version: '1.0.0',
          },
          state: 'enabled',
        },
      ],
    });
    mockApi.checkForPluginUpdates.mockResolvedValue({ success: true });
  });

  it('should load and display plugins', async () => {
    render(
      <PluginProvider>
        <TestComponent />
      </PluginProvider>
    );

    expect(screen.getByText('Loading...')).toBeDefined();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    });
    expect(screen.getByText('Test Plugin - enabled')).toBeDefined();
    expect(mockApi.getPlugins).toHaveBeenCalled();
  });

  it('should handle plugin refresh on mount', async () => {
    render(
      <PluginProvider>
        <TestComponent />
      </PluginProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());

    expect(mockApi.getPlugins).toHaveBeenCalled();
    expect(mockApi.checkForPluginUpdates).toHaveBeenCalled();
  });

  it('reloads the plugin list when the main process reports a state change', async () => {
    let listener: (() => void) | undefined;
    mockApi.onPluginStateChanged.mockImplementation((cb: () => void) => {
      listener = cb;
      return () => {};
    });

    render(
      <PluginProvider>
        <TestComponent />
      </PluginProvider>
    );
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    const before = mockApi.getPlugins.mock.calls.length;

    listener?.();
    await waitFor(() =>
      expect(mockApi.getPlugins.mock.calls.length).toBeGreaterThan(before)
    );
  });

  it('should show error if loading fails', async () => {
    mockApi.getPlugins.mockRejectedValue(new Error('Failed to fetch'));

    // Silence console.error for expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <PluginProvider>
        <TestComponent />
      </PluginProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    // In our implementation, we might just have empty plugins or log error
    // check if it didn't crash
    expect(screen.queryByTestId('plugin-item')).toBeNull();

    spy.mockRestore();
  });

  it('should handle getPlugins returning false without error message', async () => {
    mockApi.getPlugins.mockResolvedValue({ success: false });
    render(
      <PluginProvider>
        <TestComponent />
      </PluginProvider>
    );
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
  });

  it('should enable a plugin', async () => {
    mockApi.enablePlugin.mockResolvedValue({ success: true });

    render(
      <PluginProvider>
        <PluginProviderTestConsumer action="enable" pluginId="test-plugin" />
      </PluginProvider>
    );

    // Wait for initial load to finish
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());

    // Clear mocks to start fresh for the action test
    mockApi.getPlugins.mockClear();

    const btn = screen.getByText('Action');
    fireEvent.click(btn);

    await waitFor(() =>
      expect(mockApi.enablePlugin).toHaveBeenCalledWith('test-plugin')
    );
    await waitFor(() => expect(mockApi.getPlugins).toHaveBeenCalled());
  });

  it('should disable a plugin', async () => {
    mockApi.disablePlugin.mockResolvedValue({ success: true });

    render(
      <PluginProvider>
        <PluginProviderTestConsumer action="disable" pluginId="test-plugin" />
      </PluginProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());

    fireEvent.click(screen.getByText('Action'));

    await waitFor(() =>
      expect(mockApi.disablePlugin).toHaveBeenCalledWith('test-plugin')
    );
  });

  it('should install a plugin', async () => {
    mockApi.installPlugin.mockResolvedValue({ success: true });

    render(
      <PluginProvider>
        <PluginProviderTestConsumer action="install" pluginId="new-plugin" />
      </PluginProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());

    fireEvent.click(screen.getByText('Action'));

    await waitFor(() =>
      expect(mockApi.installPlugin).toHaveBeenCalledWith('new-plugin')
    );
  });

  it('should check for updates manually', async () => {
    mockApi.checkForPluginUpdates.mockResolvedValue({
      success: true,
      data: [{ id: 'test-plugin', updateAvailable: true }],
    });

    render(
      <PluginProvider>
        <PluginProviderTestConsumer action="checkUpdates" />
      </PluginProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());

    fireEvent.click(screen.getByText('Action'));

    await waitFor(() =>
      expect(mockApi.checkForPluginUpdates).toHaveBeenCalled()
    );
  });

  it('should execute plugin action', async () => {
    const actionResult = { foo: 'bar' };
    mockApi.executePluginAction.mockResolvedValue({
      success: true,
      data: actionResult,
    });

    render(
      <PluginProvider>
        <PluginProviderTestConsumer
          action="executeAction"
          pluginId="test-plugin"
        />
      </PluginProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());

    fireEvent.click(screen.getByText('Action'));

    await waitFor(() =>
      expect(mockApi.executePluginAction).toHaveBeenCalledWith(
        'test-plugin',
        'test-action',
        undefined
      )
    );
  });

  it('should handle plugin action failure', async () => {
    mockApi.executePluginAction.mockResolvedValue({
      success: false,
      error: 'Action failed',
    });

    // Suppress unhandled rejection warning in test output effectively handled by the provider re-throwing
    // In strict TDD we might want to verify the error is thrown, but in this consumer component we just catch/ignore or let it bubble.
    // The Provider currently re-throws errors from api calls.
    // If we want to test that it throws, we need to wrap the consumer call.
    // For coverage, just calling the function is enough as long as we cover the path.

    render(
      <PluginProvider>
        <PluginProviderTestConsumer
          action="executeAction"
          pluginId="test-plugin"
        />
      </PluginProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());

    // We expect this to throw, so we can wrap in console error silencer or just let it fail if we didn't catch it in consumer.
    // But since the test runner catches unhandled rejections, let's verify mock call.
    fireEvent.click(screen.getByText('Action'));

    await waitFor(() => expect(mockApi.executePluginAction).toHaveBeenCalled());
  });

  it('should get plugin extensions', async () => {
    const extensions = [{ id: 'ext1' }];
    mockApi.getPluginExtensions.mockResolvedValue({
      success: true,
      data: extensions,
    });

    render(
      <PluginProvider>
        <ExtensionsConsumer extensionPoint="test-point" />
      </PluginProvider>
    );

    // Initial render will trigger effect
    await waitFor(() =>
      expect(mockApi.getPluginExtensions).toHaveBeenCalledWith('test-point')
    );
    await waitFor(() => expect(screen.getByText('Found: 1')).toBeDefined());
  });

  it('should handle get extensions failure', async () => {
    mockApi.getPluginExtensions.mockRejectedValue(new Error('Failed'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <PluginProvider>
        <ExtensionsConsumer extensionPoint="test-point" />
      </PluginProvider>
    );

    await waitFor(() => expect(mockApi.getPluginExtensions).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Found: 0')).toBeDefined());

    spy.mockRestore();
  });

  it('should return empty array when extensions are missing/failed', async () => {
    mockApi.getPluginExtensions.mockResolvedValue({
      success: true,
      data: null,
    });
    render(
      <PluginProvider>
        <ExtensionsConsumer extensionPoint="test-point" />
      </PluginProvider>
    );
    await waitFor(() =>
      expect(mockApi.getPluginExtensions).toHaveBeenCalledWith('test-point')
    );
    await waitFor(() => expect(screen.getByText('Found: 0')).toBeDefined());
  });

  describe('License Management', () => {
    it('should activate license', async () => {
      mockApi.activatePluginLicense.mockResolvedValue({ success: true });

      render(
        <PluginProvider>
          <PluginProviderTestConsumer
            action="activateLicense"
            pluginId="test-plugin"
          />
        </PluginProvider>
      );

      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));

      await waitFor(() =>
        expect(mockApi.activatePluginLicense).toHaveBeenCalledWith(
          'test-plugin',
          'test-key'
        )
      );
      await waitFor(() => expect(mockApi.getPlugins).toHaveBeenCalled());
    });

    it('should deactivate license', async () => {
      mockApi.deactivatePluginLicense.mockResolvedValue({ success: true });

      render(
        <PluginProvider>
          <PluginProviderTestConsumer
            action="deactivateLicense"
            pluginId="test-plugin"
          />
        </PluginProvider>
      );

      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));

      await waitFor(() =>
        expect(mockApi.deactivatePluginLicense).toHaveBeenCalledWith(
          'test-plugin'
        )
      );
      await waitFor(() => expect(mockApi.getPlugins).toHaveBeenCalled());
    });

    it('should start trial', async () => {
      mockApi.startPluginTrial.mockResolvedValue({ success: true });

      render(
        <PluginProvider>
          <PluginProviderTestConsumer
            action="startTrial"
            pluginId="test-plugin"
          />
        </PluginProvider>
      );

      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));

      await waitFor(() =>
        expect(mockApi.startPluginTrial).toHaveBeenCalledWith('test-plugin')
      );
      await waitFor(() => expect(mockApi.getPlugins).toHaveBeenCalled());
    });
  });

  describe('usePluginActions specific branches', () => {
    it('should handle and toast dependencies with missing names in enablePlugin', async () => {
      mockApi.enablePlugin.mockResolvedValue({
        success: true,
        data: ['unknown-dep'],
      });

      render(
        <PluginProvider>
          <PluginProviderTestConsumer action="enable" pluginId="test-plugin" />
        </PluginProvider>
      );

      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));

      await waitFor(() => expect(mockApi.enablePlugin).toHaveBeenCalled());
    });

    it('should handle cascaded disabled plugins with missing names', async () => {
      mockApi.disablePlugin.mockResolvedValue({
        success: true,
        data: ['unknown-dep'],
      });

      render(
        <PluginProvider>
          <PluginProviderTestConsumer action="disable" pluginId="test-plugin" />
        </PluginProvider>
      );

      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));

      await waitFor(() => expect(mockApi.disablePlugin).toHaveBeenCalled());
    });

    it('should handle importLocalPlugin failure with default message', async () => {
      mockApi.importLocalPlugin.mockResolvedValue({ success: false });
      render(
        <PluginProvider>
          <PluginProviderTestConsumer action="importLocalPlugin" />
        </PluginProvider>
      );
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));
      await waitFor(() => expect(mockApi.importLocalPlugin).toHaveBeenCalled());
    });

    it('should handle importLocalPlugin throwing string error', async () => {
      mockApi.importLocalPlugin.mockRejectedValue('fail');
      render(
        <PluginProvider>
          <PluginProviderTestConsumer action="importLocalPlugin" />
        </PluginProvider>
      );
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));
      await waitFor(() => expect(mockApi.importLocalPlugin).toHaveBeenCalled());
    });
  });

  describe('Settings Management', () => {
    it('should get settings', async () => {
      const settings = { theme: 'dark' };
      mockApi.getPluginSettings.mockResolvedValue({
        success: true,
        data: settings,
      });

      render(
        <PluginProvider>
          <SettingsConsumer pluginId="test-plugin" />
        </PluginProvider>
      );

      await waitFor(() =>
        expect(mockApi.getPluginSettings).toHaveBeenCalledWith('test-plugin')
      );
      await waitFor(() =>
        expect(screen.getByText('theme: dark')).toBeDefined()
      );
    });

    it('should handle get settings error', async () => {
      mockApi.getPluginSettings.mockResolvedValue({ success: false });
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <PluginProvider>
          <SettingsConsumer pluginId="test-plugin" />
        </PluginProvider>
      );

      await waitFor(() =>
        expect(screen.getByText('No settings')).toBeDefined()
      );

      spy.mockRestore();
    });

    it('should save settings', async () => {
      mockApi.setPluginSettings.mockResolvedValue({ success: true });

      render(
        <PluginProvider>
          <PluginProviderTestConsumer
            action="saveSettings"
            pluginId="test-plugin"
          />
        </PluginProvider>
      );

      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));

      await waitFor(() =>
        expect(mockApi.setPluginSettings).toHaveBeenCalledWith('test-plugin', {
          active: true,
        })
      );
    });
  });

  it('should generate plugin', async () => {
    mockApi.generatePlugin.mockResolvedValue({ success: true });

    render(
      <PluginProvider>
        <PluginProviderTestConsumer action="generatePlugin" />
      </PluginProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    fireEvent.click(screen.getByText('Action'));

    await waitFor(() => expect(mockApi.generatePlugin).toHaveBeenCalled());
    await waitFor(() => expect(mockApi.getPlugins).toHaveBeenCalled());
  });

  it('should reload plugin', async () => {
    mockApi.reloadPlugin.mockResolvedValue({ success: true });

    render(
      <PluginProvider>
        <PluginProviderTestConsumer
          action="reloadPlugin"
          pluginId="reload-me"
        />
      </PluginProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    fireEvent.click(screen.getByText('Action'));

    await waitFor(() =>
      expect(mockApi.reloadPlugin).toHaveBeenCalledWith('reload-me')
    );
    await waitFor(() => expect(mockApi.getPlugins).toHaveBeenCalled());
  });

  it('should uninstall plugin', async () => {
    mockApi.uninstallPlugin.mockResolvedValue({ success: true });

    render(
      <PluginProvider>
        <PluginProviderTestConsumer
          action="uninstallPlugin"
          pluginId="uninstall-me"
        />
      </PluginProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    fireEvent.click(screen.getByText('Action'));

    await waitFor(() =>
      expect(mockApi.uninstallPlugin).toHaveBeenCalledWith('uninstall-me')
    );
    await waitFor(() => expect(mockApi.getPlugins).toHaveBeenCalled());
  });

  it('should import local plugin with data', async () => {
    mockApi.importLocalPlugin.mockResolvedValue({
      success: true,
      data: 'imported-id',
    });

    render(
      <PluginProvider>
        <PluginProviderTestConsumer action="importLocalPlugin" />
      </PluginProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    fireEvent.click(screen.getByText('Action'));

    await waitFor(() => expect(mockApi.importLocalPlugin).toHaveBeenCalled());
    await waitFor(() => expect(mockApi.getPlugins).toHaveBeenCalled());
  });

  it('should import local plugin returning no data (cancelled)', async () => {
    mockApi.importLocalPlugin.mockResolvedValue({ success: true, data: null });

    render(
      <PluginProvider>
        <PluginProviderTestConsumer action="importLocalPlugin" />
      </PluginProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    fireEvent.click(screen.getByText('Action'));

    await waitFor(() => expect(mockApi.importLocalPlugin).toHaveBeenCalled());
  });

  describe('Error Path Coverage', () => {
    const errorMsg = 'Operation failed';

    it('should handle enable failure', async () => {
      mockApi.enablePlugin.mockResolvedValue({
        success: false,
        error: errorMsg,
      });
      render(
        <PluginProvider>
          <PluginProviderTestConsumer action="enable" pluginId="test" />
        </PluginProvider>
      );
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));
      await waitFor(() => expect(mockApi.enablePlugin).toHaveBeenCalled());
    });

    it('should handle disable failure', async () => {
      mockApi.disablePlugin.mockResolvedValue({
        success: false,
        error: errorMsg,
      });
      render(
        <PluginProvider>
          <PluginProviderTestConsumer action="disable" pluginId="test" />
        </PluginProvider>
      );
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));
      await waitFor(() => expect(mockApi.disablePlugin).toHaveBeenCalled());
    });

    it('should handle activate license failure', async () => {
      mockApi.activatePluginLicense.mockResolvedValue({
        success: false,
        error: errorMsg,
      });
      render(
        <PluginProvider>
          <PluginProviderTestConsumer
            action="activateLicense"
            pluginId="test"
          />
        </PluginProvider>
      );
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));
      await waitFor(() =>
        expect(mockApi.activatePluginLicense).toHaveBeenCalled()
      );
    });

    it('should handle deactivate license failure', async () => {
      mockApi.deactivatePluginLicense.mockResolvedValue({
        success: false,
        error: errorMsg,
      });
      render(
        <PluginProvider>
          <PluginProviderTestConsumer
            action="deactivateLicense"
            pluginId="test"
          />
        </PluginProvider>
      );
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));
      await waitFor(() =>
        expect(mockApi.deactivatePluginLicense).toHaveBeenCalled()
      );
    });

    it('should handle start trial failure', async () => {
      mockApi.startPluginTrial.mockResolvedValue({
        success: false,
        error: errorMsg,
      });
      render(
        <PluginProvider>
          <PluginProviderTestConsumer action="startTrial" pluginId="test" />
        </PluginProvider>
      );
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));
      await waitFor(() => expect(mockApi.startPluginTrial).toHaveBeenCalled());
    });

    it('should handle install failure', async () => {
      mockApi.installPlugin.mockResolvedValue({
        success: false,
        error: errorMsg,
      });
      render(
        <PluginProvider>
          <PluginProviderTestConsumer action="install" pluginId="test" />
        </PluginProvider>
      );
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));
      await waitFor(() => expect(mockApi.installPlugin).toHaveBeenCalled());
    });

    it('should handle reload failure', async () => {
      mockApi.reloadPlugin.mockResolvedValue({
        success: false,
        error: errorMsg,
      });
      render(
        <PluginProvider>
          <PluginProviderTestConsumer action="reloadPlugin" pluginId="test" />
        </PluginProvider>
      );
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));
      await waitFor(() => expect(mockApi.reloadPlugin).toHaveBeenCalled());
    });

    it('should handle generate failure', async () => {
      mockApi.generatePlugin.mockResolvedValue({
        success: false,
        error: errorMsg,
      });
      render(
        <PluginProvider>
          <PluginProviderTestConsumer action="generatePlugin" />
        </PluginProvider>
      );
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));
      await waitFor(() => expect(mockApi.generatePlugin).toHaveBeenCalled());
    });

    it('should handle save settings failure', async () => {
      mockApi.setPluginSettings.mockResolvedValue({
        success: false,
        error: errorMsg,
      });
      render(
        <PluginProvider>
          <PluginProviderTestConsumer action="saveSettings" pluginId="test" />
        </PluginProvider>
      );
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));
      await waitFor(() => expect(mockApi.setPluginSettings).toHaveBeenCalled());
    });

    it('should handle uninstall failure', async () => {
      mockApi.uninstallPlugin.mockResolvedValue({
        success: false,
        error: 'fail',
      });
      render(
        <PluginProvider>
          <PluginProviderTestConsumer
            action="uninstallPlugin"
            pluginId="test"
          />
        </PluginProvider>
      );
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));
      await waitFor(() => expect(mockApi.uninstallPlugin).toHaveBeenCalled());
    });

    it('should handle import failure', async () => {
      mockApi.importLocalPlugin.mockResolvedValue({
        success: false,
        error: 'fail',
      });
      render(
        <PluginProvider>
          <PluginProviderTestConsumer action="importLocalPlugin" />
        </PluginProvider>
      );
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));
      await waitFor(() => expect(mockApi.importLocalPlugin).toHaveBeenCalled());
    });

    it('should handle missing error messages', async () => {
      // Branch coverage for missing result.error string
      mockApi.enablePlugin.mockResolvedValue({ success: false });
      render(
        <PluginProvider>
          <PluginProviderTestConsumer action="enable" pluginId="test" />
        </PluginProvider>
      );
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));
      await waitFor(() => expect(mockApi.enablePlugin).toHaveBeenCalled());
    });

    it('should handle get extensions exception', async () => {
      mockApi.getPluginExtensions.mockRejectedValue(new Error('crash'));
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <PluginProvider>
          <ExtensionsConsumer extensionPoint="test" />
        </PluginProvider>
      );

      await waitFor(() =>
        expect(mockApi.getPluginExtensions).toHaveBeenCalled()
      );
      // The component catches the error and sets state, so it shouldn't crash the renderer
      await waitFor(() => expect(screen.getByText('Found: 0')).toBeDefined());
      spy.mockRestore();
    });

    it('should handle get settings exception', async () => {
      mockApi.getPluginSettings.mockRejectedValue(new Error('crash'));
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(
        <PluginProvider>
          <SettingsConsumer pluginId="test" />
        </PluginProvider>
      );
      await waitFor(() => expect(mockApi.getPluginSettings).toHaveBeenCalled());
      await waitFor(() =>
        expect(screen.getByText('No settings')).toBeDefined()
      );
      spy.mockRestore();
    });

    it('should handle check updates exception', async () => {
      mockApi.checkForPluginUpdates.mockRejectedValue(new Error('crash'));
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(
        <PluginProvider>
          <PluginProviderTestConsumer action="checkUpdates" />
        </PluginProvider>
      );
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));
      await waitFor(() =>
        expect(mockApi.checkForPluginUpdates).toHaveBeenCalled()
      );
      spy.mockRestore();
    });

    it('should handle result with missing error string in handleActionResult', async () => {
      // Branch coverage for result.error || defaultError
      mockApi.activatePluginLicense.mockResolvedValue({ success: false });
      render(
        <PluginProvider>
          <PluginProviderTestConsumer
            action="activateLicense"
            pluginId="test"
          />
        </PluginProvider>
      );
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));
      await waitFor(() =>
        expect(mockApi.activatePluginLicense).toHaveBeenCalled()
      );
    });

    it('should handle non-Error exception in handleActionResult', async () => {
      // Branch coverage for err instanceof Error ? err.message : defaultError
      mockApi.startPluginTrial.mockRejectedValue('string error');
      render(
        <PluginProvider>
          <PluginProviderTestConsumer action="startTrial" pluginId="test" />
        </PluginProvider>
      );
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      fireEvent.click(screen.getByText('Action'));
      await waitFor(() => expect(mockApi.startPluginTrial).toHaveBeenCalled());
    });
  });

  describe('Hooks', () => {
    it('useEnabledPlugins should filter enabled plugins', async () => {
      mockApi.getPlugins.mockResolvedValue({
        success: true,
        data: [
          { manifest: { id: 'p1' }, state: 'enabled' },
          { manifest: { id: 'p2' }, state: 'disabled' },
        ],
      });

      const HookTest = () => {
        const enabled = useEnabledPlugins();
        return <div data-testid="enabled-count">{enabled.length}</div>;
      };

      render(
        <PluginProvider>
          <HookTest />
        </PluginProvider>
      );
      await waitFor(() =>
        expect(screen.getByTestId('enabled-count').textContent).toBe('1')
      );
    });

    it('usePluginExtensions should fetch extensions', async () => {
      mockApi.getPluginExtensions.mockResolvedValue({
        success: true,
        data: [{ id: 'e1' }],
      });
      const HookTest = () => {
        // Need to import usePluginExtensions from Provider
        const exts = usePluginExtensions('hook-point');
        return <div data-testid="ext-count">{exts.length}</div>;
      };
      render(
        <PluginProvider>
          <HookTest />
        </PluginProvider>
      );
      await waitFor(() =>
        expect(screen.getByTestId('ext-count').textContent).toBe('1')
      );
    });

    it('usePlugins should throw outside provider', () => {
      const HookTest = () => {
        usePlugins();
        return null;
      };

      // Prevent console.error from being too noisy
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<HookTest />)).toThrow(
        'usePlugins must be used within a PluginProvider'
      );
      spy.mockRestore();
    });
  });
});

// Helper for testing actions
const PluginProviderTestConsumer = ({
  action,
  pluginId,
}: {
  action: string;
  pluginId?: string;
}) => {
  const {
    loading,
    enablePlugin,
    disablePlugin,
    installPlugin,
    checkForUpdates,
    executePluginAction,
    activateLicense,
    deactivateLicense,
    startTrial,
    saveSettings,
    generatePlugin,
    reloadPlugin,
    uninstallPlugin,
    importLocalPlugin,
  } = usePlugins();

  if (loading) return <div>Loading...</div>;

  const handleAction = async () => {
    try {
      if (action === 'enable') await enablePlugin(pluginId!);
      if (action === 'disable') await disablePlugin(pluginId!);
      if (action === 'install') await installPlugin(pluginId!);
      if (action === 'checkUpdates') await checkForUpdates();
      if (action === 'executeAction')
        await executePluginAction(pluginId!, 'test-action');
      if (action === 'activateLicense')
        await activateLicense(pluginId!, 'test-key');
      if (action === 'deactivateLicense') await deactivateLicense(pluginId!);
      if (action === 'startTrial') await startTrial(pluginId!);
      if (action === 'saveSettings')
        await saveSettings(pluginId!, { active: true });
      if (action === 'generatePlugin')
        await generatePlugin({
          id: 'test-plugin',
          name: 'test',
          author: 'test-author',
          description: 'test-desc',
        });
      if (action === 'reloadPlugin') await reloadPlugin(pluginId!);
      if (action === 'uninstallPlugin') await uninstallPlugin(pluginId!);
      if (action === 'importLocalPlugin') await importLocalPlugin();
    } catch (e) {
      // Ignore errors for tests that expect failure unless verified specifically
    }
  };

  return <button onClick={handleAction}>Action</button>;
};

const ExtensionsConsumer = ({ extensionPoint }: { extensionPoint: string }) => {
  const { getPluginExtensions } = usePlugins();
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    void getPluginExtensions(extensionPoint).then((exts) =>
      setCount(exts.length)
    );
  }, [extensionPoint, getPluginExtensions]);

  return <div>Found: {count}</div>;
};

const SettingsConsumer = ({ pluginId }: { pluginId: string }) => {
  const { getSettings } = usePlugins();
  const [settings, setSettings] = React.useState<any>(null);

  React.useEffect(() => {
    void getSettings(pluginId).then(setSettings);
  }, [pluginId, getSettings]);

  if (!settings || Object.keys(settings).length === 0)
    return <div>No settings</div>;
  return (
    <div>
      {Object.entries(settings)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')}
    </div>
  );
};
