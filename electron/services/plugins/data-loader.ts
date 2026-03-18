/**
 * Plugin Data Loader
 *
 * Loads initial data/configuration files for plugins.
 * Similar to Odoo's data loading mechanism.
 */

import fs from 'fs/promises';
import path from 'path';
import type {
  PluginManifest,
  PluginDataFile,
  StorageAPI,
} from '../../types/plugin-types';

import yaml from 'js-yaml';
import { getErrorMessage } from '../../utils/error-utils';
import log from '../../logger';

export class DataLoader {
  /**
   * Load data files specified in plugin manifest
   */
  async loadPluginData(
    pluginPath: string,
    manifest: PluginManifest
  ): Promise<PluginDataFile[]> {
    const dataFiles: PluginDataFile[] = [];

    if (!manifest.data || manifest.data.length === 0) {
      return dataFiles;
    }

    for (const dataPath of manifest.data) {
      try {
        const fullPath = path.join(pluginPath, dataPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        const extension = path.extname(dataPath).toLowerCase();

        let parsed: unknown;
        if (extension === '.json') {
          parsed = JSON.parse(content);
        } else if (extension === '.yaml' || extension === '.yml') {
          parsed = yaml.load(content);
        } else {
          log.warn(`[DataLoader] Unsupported data file format: ${extension}`);
          continue;
        }

        dataFiles.push({
          path: dataPath,
          content: parsed,
        });

        log.info(`[DataLoader] Loaded data file: ${dataPath}`);
      } catch (error: unknown) {
        const msg = getErrorMessage(error);
        log.error(`[DataLoader] Failed to load data file ${dataPath}:`, msg);
        throw new Error(`Failed to load data file ${dataPath}: ${msg}`);
      }
    }

    return dataFiles;
  }

  /**
   * Apply loaded data to plugin storage
   */
  async applyDataToStorage(
    pluginId: string,
    dataFiles: PluginDataFile[],
    storageAPI: StorageAPI
  ): Promise<void> {
    for (const dataFile of dataFiles) {
      // Store each data file's content in plugin storage
      // Remove file extension since storage API adds .json automatically
      // Use forward slash instead of colon to avoid Windows path issues
      const pathWithoutExt = dataFile.path.replace(/\.(json|yaml|yml)$/i, '');
      const key = `data/${pathWithoutExt}`;
      await storageAPI.set(key, dataFile.content);

      log.info(
        `[DataLoader] Applied data from ${dataFile.path} to storage for ${pluginId}`
      );
    }
  }
}

export const dataLoader = new DataLoader();
