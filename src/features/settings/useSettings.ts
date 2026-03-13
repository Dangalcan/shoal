import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useApi } from '../../services/api-context';
import { toast } from 'sonner';
import { SettingsState, UseSettingsResult } from './types';

export function useSettings(): UseSettingsResult {
  const api = useApi();

  // Local Storage State
  const [defaultNamespace, setDefaultNamespace] = useLocalStorage<string>(
    'k8s_desktop_default_namespace',
    ''
  );
  const [autoRefresh, setAutoRefresh] = useLocalStorage<boolean>(
    'k8s_desktop_auto_refresh',
    true
  );
  const [refreshInterval, setRefreshInterval] = useLocalStorage<number>(
    'k8s_desktop_refresh_interval',
    10
  );

  // Internal State
  const [kubeconfigPath, setKubeconfigPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [localSettingsSaved, setLocalSettingsSaved] = useState(false);
  const isFirstRender = useRef(true);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flash the "saved" indicator whenever a localStorage setting changes (skip initial render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setLocalSettingsSaved(true);
    savedTimer.current = setTimeout(() => setLocalSettingsSaved(false), 2000);
  }, [defaultNamespace, autoRefresh, refreshInterval]);

  // Initial Fetch
  useEffect(() => {
    const fetchKubeconfig = async () => {
      const result = await api.getKubeconfigPath();
      if (result.success) {
        setKubeconfigPath(result.data);
      }
    };
    fetchKubeconfig();
  }, [api]);

  // Handlers
  const handleSaveKubeconfig = useCallback(async () => {
    setSaving(true);
    try {
      const result = await api.setKubeconfigPath(kubeconfigPath);
      if (result.success) {
        toast.success('Kubeconfig path updated successfully');
      } else {
        toast.error(`Error updating Kubeconfig: ${result.error}`);
      }
    } finally {
      setSaving(false);
    }
  }, [api, kubeconfigPath]);

  return {
    kubeconfigPath,
    defaultNamespace,
    autoRefresh,
    refreshInterval,
    saving,
    localSettingsSaved,
    setKubeconfigPath,
    setDefaultNamespace,
    setAutoRefresh,
    setRefreshInterval,
    handleSaveKubeconfig,
  };
}
