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

  async runCommand(
    command: string
  ): Promise<Result<{ stdout: string; stderr: string }>> {
    return window.electron.runCommand(command);
  }

  async checkTool(tool: string): Promise<Result<boolean>> {
    return window.electron.checkTool(tool);
  }

  async createCluster(name: string, provider: string): Promise<Result<void>> {
    return window.electron.createCluster(name, provider);
  }

  async getClusters(): Promise<Result<string[]>> {
    return window.electron.getClusters();
  }

  async deleteCluster(name: string): Promise<Result<void>> {
    return window.electron.deleteCluster(name);
  }

  async getCurrentContext(): Promise<Result<string>> {
    return window.electron.getCurrentContext();
  }

  async getPods(contextName: string): Promise<Result<any[]>> {
    return window.electron.getPods(contextName);
  }

  async getNamespaces(contextName: string): Promise<Result<string[]>> {
    return window.electron.getNamespaces(contextName);
  }

  async getResources(args: {
    contextName: string;
    resourceType: string;
    namespace: string;
  }): Promise<Result<any[]>> {
    return window.electron.getResources(args);
  }

  async getLogs(args: {
    contextName: string;
    podName: string;
    namespace: string;
    tailLines?: number;
  }): Promise<Result<string>> {
    return window.electron.getLogs(args);
  }

  async describeResource(args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }): Promise<Result<string>> {
    return window.electron.describeResource(args);
  }

  async getResourceYaml(args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }): Promise<Result<string>> {
    return window.electron.getResourceYaml(args);
  }

  async rolloutRestart(args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }): Promise<Result<void>> {
    return window.electron.rolloutRestart(args);
  }

  async deleteResource(args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }): Promise<Result<void>> {
    return window.electron.deleteResource(args);
  }
}

export const electronService = ElectronService.getInstance();
