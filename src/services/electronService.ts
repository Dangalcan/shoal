import { Result } from '../types/result';

export class ElectronService {
  private static instance: ElectronService;

  private constructor() {}

  public static getInstance(): ElectronService {
    if (!ElectronService.instance) {
      ElectronService.instance = new ElectronService();
    }
    return ElectronService.instance;
  }

  async getClusters(): Promise<Result<string[]>> {
    return window.electron.getClusters();
  }

  async deleteCluster(name: string): Promise<Result<void>> {
    return window.electron.deleteCluster(name);
  }

  async checkTool(tool: 'docker' | 'podman'): Promise<Result<boolean>> {
    return window.electron.checkTool(tool);
  }

  async getCurrentContext(): Promise<Result<string>> {
    return window.electron.getCurrentContext();
  }

  // Wrapper for any other electron calls to be added here
}

export const electronService = ElectronService.getInstance();
