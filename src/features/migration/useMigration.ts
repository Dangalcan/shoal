import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useApi } from '../../services/api-context';
import { useAsyncData } from '../../hooks/useAsyncData';
import { handleAsyncOperation } from '../../lib/async-operation-handler';
import type {
  ComposeConversion,
  ConvertedManifest,
  KomposeStatus,
  MigrationImportResult,
} from '../../types';

export type MigrationStep = 'select' | 'review' | 'done';

export interface UseMigrationResult {
  komposeStatus: KomposeStatus | null;
  checkingKompose: boolean;
  recheckKompose: () => Promise<void>;
  currentContext: string | null;
  step: MigrationStep;
  composePath: string | null;
  conversion: ComposeConversion | null;
  converting: boolean;
  importing: boolean;
  importResult: MigrationImportResult | null;
  selectAndConvert: () => Promise<void>;
  updateManifest: (index: number, content: string) => void;
  removeManifest: (index: number) => void;
  importManifests: (projectName: string) => Promise<{ success: boolean }>;
  reset: () => void;
}

/** No usable kubectl context — getCurrentContext returns this literal. */
const NO_CONTEXT = 'None';

/**
 * State machine for the Docker Compose → Kubernetes migration wizard:
 * select a compose file, review/edit the manifests kompose generated,
 * then import them into the manifest library as a folder.
 */
export function useMigration(): UseMigrationResult {
  const api = useApi();

  const {
    data: komposeStatus,
    loading: checkingKompose,
    refetch: recheckKompose,
  } = useAsyncData<KomposeStatus>({
    fetchFn: () => api.migrationCheckKompose(),
    errorTitle: 'Failed to check for kompose',
  });

  const { data: currentContext } = useAsyncData<string>({
    fetchFn: () => api.getCurrentContext(),
  });

  const [composePath, setComposePath] = useState<string | null>(null);
  const [conversion, setConversion] = useState<ComposeConversion | null>(null);
  const [converting, setConverting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] =
    useState<MigrationImportResult | null>(null);

  const step: MigrationStep = importResult
    ? 'done'
    : conversion
      ? 'review'
      : 'select';

  const selectAndConvert = useCallback(async () => {
    const selected = await api.migrationSelectComposeFile();
    if (!selected.success) {
      toast.error(selected.error ?? 'Failed to open the file picker');
      return;
    }
    if (!selected.data) return; // dialog cancelled

    const { token, filePath } = selected.data;
    setConverting(true);
    try {
      const result = await handleAsyncOperation(
        () => api.migrationConvertCompose(token),
        {
          loadingMessage: 'Converting compose file with kompose...',
          successMessage: 'Compose file converted.',
          errorTitle: 'Conversion failed',
        }
      );
      if (result.success && result.data) {
        setComposePath(filePath);
        setConversion(result.data);
      }
    } finally {
      setConverting(false);
    }
  }, [api]);

  const updateManifest = useCallback((index: number, content: string) => {
    setConversion((prev) => {
      if (!prev) return prev;
      const manifests: ConvertedManifest[] = prev.manifests.map(
        (manifest, i) => (i === index ? { ...manifest, content } : manifest)
      );
      return { ...prev, manifests };
    });
  }, []);

  const removeManifest = useCallback((index: number) => {
    setConversion((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        manifests: prev.manifests.filter((_, i) => i !== index),
      };
    });
  }, []);

  const importManifests = useCallback(
    async (projectName: string) => {
      if (!conversion || conversion.manifests.length === 0) {
        toast.error('Nothing to import');
        return { success: false };
      }
      if (!currentContext || currentContext === NO_CONTEXT) {
        toast.error(
          'No active cluster context. Create or select a cluster first.'
        );
        return { success: false };
      }

      setImporting(true);
      try {
        const result = await handleAsyncOperation(
          () =>
            api.migrationImportManifests({
              projectName,
              contextName: currentContext,
              manifests: conversion.manifests.map((manifest) => ({
                name: manifest.fileName,
                content: manifest.content,
              })),
            }),
          {
            loadingMessage: `Importing ${conversion.manifests.length} manifests...`,
            successMessage: `Imported into manifest folder "${projectName}".`,
            errorTitle: 'Import failed',
          }
        );
        if (result.success && result.data) {
          setImportResult(result.data);
        }
        return { success: result.success };
      } finally {
        setImporting(false);
      }
    },
    [api, conversion, currentContext]
  );

  const reset = useCallback(() => {
    setComposePath(null);
    setConversion(null);
    setImportResult(null);
  }, []);

  return {
    komposeStatus,
    checkingKompose,
    recheckKompose,
    currentContext,
    step,
    composePath,
    conversion,
    converting,
    importing,
    importResult,
    selectAndConvert,
    updateManifest,
    removeManifest,
    importManifests,
    reset,
  };
}
