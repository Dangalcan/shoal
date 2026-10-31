import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useApi } from '../../services/api-context';
import { toast } from 'sonner';
import { useClusterContext } from '../clusters/ClusterContext';
import { UseSettingsResult } from './types';

/** How long the "saved" indicator stays on after a local setting changes. */
const SAVED_FLASH_MS = 2000;

export function useSettings(): UseSettingsResult {
  const api = useApi();
  const { fetchClusters } = useClusterContext();

  // Local Storage State
  const [defaultNamespace, storeDefaultNamespace] = useLocalStorage<string>(
    'k8s_desktop_default_namespace',
    ''
  );
  const [autoRefresh, storeAutoRefresh] = useLocalStorage<boolean>(
    'k8s_desktop_auto_refresh',
    true
  );
  const [refreshInterval, storeRefreshInterval] = useLocalStorage<number>(
    'k8s_desktop_refresh_interval',
    10
  );

  // Internal State
  const [kubeconfigPath, setKubeconfigPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [localSettingsSaved, setLocalSettingsSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flash the "saved" indicator whenever a localStorage setting changes;
  // another change inside the window restarts the timer.
  const flashSaved = useCallback(() => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setLocalSettingsSaved(true);
    savedTimer.current = setTimeout(
      () => setLocalSettingsSaved(false),
      SAVED_FLASH_MS
    );
  }, []);
  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    []
  );

  const setDefaultNamespace = (ns: string) => {
    storeDefaultNamespace(ns);
    flashSaved();
  };
  const setAutoRefresh = (enabled: boolean) => {
    storeAutoRefresh(enabled);
    flashSaved();
  };
  const setRefreshInterval = (seconds: number) => {
    storeRefreshInterval(seconds);
    flashSaved();
  };

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
        // A different kubeconfig means different contexts: refresh the
        // cluster list and current context right away.
        await fetchClusters();
      } else {
        toast.error(`Error updating Kubeconfig: ${result.error}`);
      }
    } finally {
      setSaving(false);
    }
  }, [api, kubeconfigPath, fetchClusters]);

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
