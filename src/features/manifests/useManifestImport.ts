import { useState } from 'react';
import { toast } from 'sonner';
import { isFileDrag } from './manifest-dnd';
import {
  readManifestFile,
  type ImportedManifest,
} from './manifest-file-import';
import type { Result } from '../../types/result';

export interface UseManifestImportOptions {
  /** Stores one imported manifest. */
  saveImported: (manifest: ImportedManifest) => Promise<Result<unknown>>;
  /** Called once when at least one file was imported. */
  onImported: () => void | Promise<void>;
}

export interface UseManifestImportResult {
  /** Change handler of the hidden file input. */
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  /** True while YAML files are dragged over the page. */
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => Promise<void>;
}

/**
 * Importing YAML files into the manifest library, from the file picker or
 * dropped on the page. Every file is reported: one success toast for the
 * imports, one error toast listing the files that could not be read or
 * stored.
 */
export function useManifestImport({
  saveImported,
  onImported,
}: UseManifestImportOptions): UseManifestImportResult {
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = async (files: FileList | File[]) => {
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;

      try {
        const manifest = await readManifestFile(file);
        const result = await saveImported(manifest);

        if (result.success) {
          successCount++;
        } else {
          failCount++;
          errors.push(`${file.name}: ${result.error || 'Save failed'}`);
        }
      } catch (err: unknown) {
        failCount++;
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    if (successCount > 0) {
      toast.success(
        `Successfully imported ${successCount} manifest${successCount > 1 ? 's' : ''}`
      );
      await onImported();
    }

    if (failCount > 0) {
      toast.error(
        `Failed to import ${failCount} file${failCount > 1 ? 's' : ''}: ${errors.join(', ')}`
      );
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const filesArray = Array.from(files);
      e.target.value = '';
      await processFiles(filesArray);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(Array.from(files));
    }
  };

  return { handleFileUpload, isDragging, onDragOver, onDragLeave, onDrop };
}
