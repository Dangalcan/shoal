import type { ResourceType, ColumnDef } from './resource-types';
import { RESOURCE_CONFIGS } from './resource-configs';

export const COLUMN_DEFINITIONS = RESOURCE_CONFIGS.reduce(
  (acc, config) => {
    acc[config.id] = config.columns;
    return acc;
  },
  {} as Record<ResourceType, ColumnDef[]>
);
