import type { K8sResource } from '../../types/k8s-types';
import type { SorterFunction } from './types';

/**
 * Creates a sorter for string values
 */
export const sortByString = (
  getter: (r: K8sResource) => string
): SorterFunction => {
  return (a, b) => {
    const valA = getter(a) || '';
    const valB = getter(b) || '';
    return valA.localeCompare(valB);
  };
};

/**
 * Creates a sorter for number values
 */
export const sortByNumber = (
  getter: (r: K8sResource) => number
): SorterFunction => {
  return (a, b) => {
    const valA = getter(a) || 0;
    const valB = getter(b) || 0;
    return valA - valB;
  };
};

/**
 * Creates a sorter for date values (from string or number)
 */
export const sortByDate = (
  getter: (r: K8sResource) => string | number | undefined
): SorterFunction => {
  return (a, b) => {
    const valA = new Date(getter(a) || 0).getTime();
    const valB = new Date(getter(b) || 0).getTime();
    return valA - valB;
  };
};

/**
 * Reverses a sorter function
 */
export const reverseSorter = (sorter: SorterFunction): SorterFunction => {
  return (a, b) => sorter(b, a); // Note: b, a order reverses the sort
};
