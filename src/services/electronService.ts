export class ElectronService {
  private static instance: ElectronService;

  private constructor() {}

  public static getInstance(): ElectronService {
    if (!ElectronService.instance) {
      ElectronService.instance = new ElectronService();
    }
    return ElectronService.instance;
  }

  async getClusters(): Promise<string[]> {
    try {
      return await window.electron.getClusters();
    } catch (error) {
      console.error('ElectronService: getClusters failed', error);
      throw error;
    }
  }

  async deleteCluster(
    name: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await window.electron.deleteCluster(name);
    } catch (error) {
      console.error(
        `ElectronService: deleteCluster failed for "${name}"`,
        error
      );
      throw error; // Let the caller handle unexpected crashes
    }
  }

  async checkTool(tool: 'docker' | 'podman'): Promise<boolean> {
    try {
      return await window.electron.checkTool(tool);
    } catch (error) {
      console.error(`ElectronService: checkTool failed for "${tool}"`, error);
      return false;
    }
  }

  async getCurrentContext(): Promise<string> {
    try {
      return await window.electron.getCurrentContext();
    } catch (error) {
      console.error('ElectronService: getCurrentContext failed', error);
      return 'None';
    }
  }

  // Wrapper for any other electron calls to be added here
}

export const electronService = ElectronService.getInstance();
