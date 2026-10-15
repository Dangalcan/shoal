import { describe, it, expect, vi, afterEach } from 'vitest';
import { electronService } from '../../services/electronService';

describe('ElectronService', () => {
  const getMockApi = () => (window as any).electron;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be a singleton', () => {
    const instance1 = (electronService as any).constructor.getInstance();
    const instance2 = (electronService as any).constructor.getInstance();
    expect(instance1).toBe(instance2);
    expect(instance1).toBe(electronService);
  });

  it('getAppInfo calls window.electron.getAppInfo', async () => {
    await electronService.getAppInfo();
    expect(getMockApi().getAppInfo).toHaveBeenCalled();
  });

  it('openExternal calls window.electron.openExternal', async () => {
    await electronService.openExternal('https://example.com');
    expect(getMockApi().openExternal).toHaveBeenCalledWith(
      'https://example.com'
    );
  });

  it('logRendererError forwards the report', async () => {
    const report = { message: 'boom', source: 'window.onerror' } as any;
    await electronService.logRendererError(report);
    expect(getMockApi().logRendererError).toHaveBeenCalledWith(report);
  });

  it('logRendererError does not throw without the preload bridge', async () => {
    const bridge = getMockApi();
    const spy = vi
      .spyOn(window, 'electron', 'get')
      .mockReturnValue(undefined as unknown as typeof window.electron);
    try {
      await expect(
        electronService.logRendererError({ message: 'boom' } as any)
      ).resolves.toBeUndefined();
    } finally {
      spy.mockRestore();
    }
    expect(getMockApi()).toBe(bridge);
  });
});
