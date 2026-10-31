export interface ImportedManifest {
  /** The file name without its extension. */
  name: string;
  content: string;
}

/** Reads a YAML file the user picked or dropped. */
export function readManifestFile(file: File): Promise<ImportedManifest> {
  return new Promise((resolve, reject) => {
    if (
      !file.name.toLowerCase().endsWith('.yaml') &&
      !file.name.toLowerCase().endsWith('.yml')
    ) {
      reject(new Error(`Invalid file type: ${file.name}`));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const target = e.target;
      if (target && typeof target.result === 'string') {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        resolve({ name: nameWithoutExt, content: target.result });
      } else {
        reject(new Error(`Failed to read file: ${file.name}`));
      }
    };
    reader.onerror = () =>
      reject(new Error(`Error reading file: ${file.name}`));
    reader.readAsText(file);
  });
}
