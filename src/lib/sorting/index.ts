import type { ResourceType } from '../resources/resource-definitions';
import {
  compareFieldValues,
  getFieldColumn,
  type FieldColumn,
} from '../resources/field-columns';
import type { SorterFunction } from './types';
import * as Sorters from './resourceSorters';

export * from './types';

/**
 * Sorts by a field column's value (see `compareFieldValues`): the same value
 * the cell shows, so the order matches what the table displays.
 */
const sortByFieldColumn =
  (column: FieldColumn): SorterFunction =>
  (a, b) =>
    compareFieldValues(column.value(a), column.value(b));

/**
 * Returns a sorter function for a given column and resource type. A field
 * column of the kind wins over the shared cases below, which assume the
 * workload meaning of ids such as `available`.
 */
export const getSorterForColumn = (
  columnId: string,
  resourceType: ResourceType
): SorterFunction => {
  const field = getFieldColumn(resourceType, columnId);
  return field
    ? sortByFieldColumn(field)
    : getColumnSorter(columnId, resourceType);
};

/** The sorter of a column that is not a field column. */
const getColumnSorter = (
  columnId: string,
  resourceType: ResourceType
): SorterFunction => {
  switch (columnId) {
    case 'name':
      return Sorters.sortByName;
    case 'namespace':
      return Sorters.sortByNamespace;
    case 'age':
      return Sorters.sortByAge;

    case 'status':
      return Sorters.getStatusSorter(resourceType);

    case 'restarts':
      return Sorters.sortByRestarts;
    case 'ip':
      return Sorters.sortByIP;
    case 'node':
      return Sorters.sortByNode;

    case 'replicas':
    case 'current': // often maps to replicas count
      return Sorters.sortByReplicas;
    case 'ready':
      return Sorters.sortByReadyReplicas;
    case 'updated':
      return Sorters.sortByUpdatedReplicas;
    case 'available':
      return Sorters.sortByAvailableReplicas;

    case 'data':
      return Sorters.sortByDataCount;

    case 'roles':
      return Sorters.sortByNodeRoles;
    case 'version':
      return Sorters.sortByKubeletVersion;
    case 'os-image':
      return Sorters.sortByOSImage;
    case 'kernel-version':
      return Sorters.sortByKernelVersion;
    case 'container-runtime':
      return Sorters.sortByContainerRuntime;
    case 'internal-ip':
      return Sorters.sortByInternalIP;
    case 'external-ip':
      return Sorters.sortByExternalIP;

    case 'containers':
      return Sorters.sortByContainers;
    case 'images':
      return Sorters.sortByImages;
    case 'selector':
      return Sorters.sortBySelector;

    default:
      // Default fallback: Try to sort by properties on the object itself if they exist at root
      // This mirrors the default behavior of the previous implementation
      return (a, b) => {
        const valA = (a as unknown as Record<string, unknown>)[columnId] || '';
        const valB = (b as unknown as Record<string, unknown>)[columnId] || '';
        if (valA < valB) return -1;
        if (valA > valB) return 1;
        return 0;
      };
  }
};
