import type { K8sResource } from './types/k8s-types';
import type { Result } from './types/result';

export interface ElectronAPI {
  runCommand: (command: string) => Promise<
    Result<{
      stdout: string;
      stderr: string;
    }>
  >;
  checkTool: (tool: string) => Promise<Result<boolean>>;
  createCluster: (name: string, provider: string) => Promise<Result<void>>;
  getClusters: () => Promise<Result<string[]>>;
  deleteCluster: (name: string) => Promise<Result<void>>;
  getCurrentContext: () => Promise<Result<string>>;
  switchContext: (contextName: string) => Promise<Result<boolean>>;
  getPods: (contextName: string) => Promise<Result<K8sResource[]>>;
  getNamespaces: (contextName: string) => Promise<Result<string[]>>;
  getResources: (args: {
    contextName: string;
    resourceType: string;
    namespace: string;
  }) => Promise<Result<K8sResource[]>>;
  getLogs: (args: {
    contextName: string;
    podName: string;
    namespace: string;
    tailLines?: number;
  }) => Promise<Result<string>>;
  describeResource: (args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }) => Promise<Result<string>>;
  getResourceYaml: (args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }) => Promise<Result<string>>;
  rolloutRestart: (args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }) => Promise<Result<void>>;
  deleteResource: (args: {
    contextName: string;
    resourceType: string;
    resourceName: string;
    namespace: string;
  }) => Promise<Result<void>>;
  getAppVersion: () => Promise<Result<string>>;
  getKubeconfigPath: () => Promise<Result<string>>;
  setKubeconfigPath: (path: string) => Promise<Result<boolean>>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
