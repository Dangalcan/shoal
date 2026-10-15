import type { Result } from '../types/result';
import type { AppInfo, RendererErrorReport } from '../types.d';

/**
 * The few bridge calls made outside the ApiProvider: the error boundary and
 * the global error listeners run before, or without, the React tree that
 * provides `useApi()`. Everything else goes through `useApi()`.
 */
export class ElectronService {
  private static instance: ElectronService;

  private constructor() {}

  public static getInstance(): ElectronService {
    if (!ElectronService.instance) {
      ElectronService.instance = new ElectronService();
    }
    return ElectronService.instance;
  }

  /**
   * Used outside the ApiProvider (ErrorBoundary, global error listeners), so
   * it must not throw when the preload bridge is missing.
   */
  async logRendererError(report: RendererErrorReport): Promise<void> {
    await window.electron?.logRendererError?.(report);
  }

  async getAppInfo(): Promise<Result<AppInfo>> {
    return window.electron.getAppInfo();
  }

  async openExternal(url: string): Promise<Result<boolean>> {
    return window.electron.openExternal(url);
  }
}

export const electronService = ElectronService.getInstance();
