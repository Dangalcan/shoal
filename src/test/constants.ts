/**
 * Test Constants
 *
 * Centralized constants for test configuration, timeouts, and common values.
 * Use these constants instead of hard-coding values in test files.
 */

/**
 * Standard timeout values for async operations in tests
 */
export const TEST_TIMEOUTS = {
  /** Default timeout for most operations (1 second) */
  DEFAULT: 1000,

  /** Timeout for async operations like state updates (3 seconds) */
  ASYNC_OPERATION: 3000,

  /** Timeout for operations that involve Electron IPC or network (4 seconds) */
  NETWORK_REQUEST: 4000,

  /** Extended timeout for complex operations (5 seconds) */
  EXTENDED: 5000,
} as const;

/**
 * Common test data values
 */
export const TEST_DATA = {
  /** Default cluster name for tests */
  DEFAULT_CLUSTER_NAME: 'test-cluster',

  /** Default namespace */
  DEFAULT_NAMESPACE: 'default',

  /** Common cluster names for multi-cluster tests */
  CLUSTER_NAMES: ['cluster-1', 'cluster-2', 'cluster-3'],

  /** Common context names */
  CONTEXT_NAMES: ['kind-test-cluster', 'k3d-test-cluster'],
} as const;

/**
 * Test configuration values
 */
export const TEST_CONFIG = {
  /** Number of retries for flaky tests */
  RETRY_COUNT: 2,

  /** Debounce delay for input tests */
  INPUT_DEBOUNCE: 300,
} as const;
