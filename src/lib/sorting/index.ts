import type { ResourceType } from '../resources/resource-definitions';
import {
  compareFieldValues,
  getCellColumn,
  getFieldColumn,
  type FieldColumn,
} from '../resources/field-columns';
import type { SortDirection, SorterFunction } from './types';
import * as Sorters from './resourceSorters';

export * from './types';

/**
 * Sorts by a field column's value (see `compareFieldValues`): the same value
 * the cell shows, so the order matches what the table displays. Missing values
 * stay last in both directions — reversing the ascending order would put them
 * first when sorting descending.
 */
const sortByFieldColumn =
  (column: FieldColumn, direction: SortDirection): SorterFunction =>
  (a, b) => {
    const left = column.value(a);
    const right = column.value(b);
    if (left === undefined || right === undefined) {
      return (left === undefined ? 1 : 0) - (right === undefined ? 1 : 0);
    }
    const cmp = compareFieldValues(left, right);
    return direction === 'desc' ? -cmp : cmp;
  };

/** Flip a classic sorter for descending; empty-string missing values stay last. */
const withDirection = (
  sorter: SorterFunction,
  direction: SortDirection
): SorterFunction => (direction === 'asc' ? sorter : (a, b) => -sorter(a, b));

/**
 * The sorter of a column, if it has one. A column listed for the kind wins
 * over the shared cases below, which assume the workload meaning of ids such
 * as `available`.
 */
const findSorter = (
  columnId: string,
  resourceType: ResourceType,
  direction: SortDirection
): SorterFunction | undefined => {
  const column =
    getFieldColumn(resourceType, columnId) ??
    getCellColumn(resourceType, columnId);
  if (column) return sortByFieldColumn(column, direction);
  const sorter = getColumnSorter(columnId, resourceType);
  return sorter ? withDirection(sorter, direction) : undefined;
};

/** True when clicking the column's header can reorder the table. */
export const hasColumnSorter = (
  columnId: string,
  resourceType: ResourceType
): boolean => findSorter(columnId, resourceType, 'asc') !== undefined;

/**
 * Returns a sorter function for a given column and resource type. Pass the
 * sort direction so field columns can keep empty values last when descending
 * instead of reversing the ascending result. A test walks every declared
 * column through hasColumnSorter, so the no-op is only for an id no table
 * declares.
 */
export const getSorterForColumn = (
  columnId: string,
  resourceType: ResourceType,
  direction: SortDirection = 'asc'
): SorterFunction => findSorter(columnId, resourceType, direction) ?? (() => 0);

/** The sorter of a column that is not a field column. */
const getColumnSorter = (
  columnId: string,
  resourceType: ResourceType
): SorterFunction | undefined => {
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
      return undefined;
  }
};
