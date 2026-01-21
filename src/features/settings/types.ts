export interface SettingsState {
  kubeconfigPath: string;
  defaultNamespace: string;
  autoRefresh: boolean;
  refreshInterval: number;
  saving: boolean;
}

export interface UseSettingsResult extends SettingsState {
  setKubeconfigPath: (path: string) => void;
  setDefaultNamespace: (ns: string) => void;
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (seconds: number) => void;
  handleSaveKubeconfig: () => Promise<void>;
}
