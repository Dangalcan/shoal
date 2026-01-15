/**
 * DOM Query Test Helpers
 *
 * Helper functions for common DOM query patterns and assertions.
 * These helpers make tests more readable and reduce duplication.
 */

import { screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { TEST_TIMEOUTS } from '../constants';

/**
 * Wait for text to appear in the document with a standard timeout
 *
 * @param text - Text to search for (string or regex)
 * @param timeout - Custom timeout (defaults to NETWORK_REQUEST)
 * @returns Promise that resolves when text is found
 *
 * @example
 * ```typescript
 * await expectTextToAppear('Loading complete')
 * await expectTextToAppear(/cluster-\d+/)
 * ```
 */
export const expectTextToAppear = async (
  text: string | RegExp,
  timeout: number = TEST_TIMEOUTS.NETWORK_REQUEST
) => {
  const element = await screen.findByText(text, {}, { timeout });
  expect(element).toBeInTheDocument();
  return element;
};

/**
 * Find elements that appear multiple times and verify count
 *
 * Useful when the same text appears in multiple places (e.g., cluster name
 * in both the active context card and the cluster list).
 *
 * @param text - Text to search for
 * @param minOccurrences - Minimum number of expected occurrences
 * @param timeout - Custom timeout (defaults to NETWORK_REQUEST)
 * @returns Promise that resolves to array of elements
 *
 * @example
 * ```typescript
 * // Verify 'cluster-1' appears at least twice
 * await expectMultipleOccurrences('cluster-1', 2)
 * ```
 */
export const expectMultipleOccurrences = async (
  text: string | RegExp,
  minOccurrences: number = 1,
  timeout: number = TEST_TIMEOUTS.NETWORK_REQUEST
) => {
  const elements = await screen.findAllByText(text, {}, { timeout });
  expect(elements.length).toBeGreaterThanOrEqual(minOccurrences);
  return elements;
};

/**
 * Wait for loading spinner to disappear
 *
 * @param timeout - Custom timeout (defaults to ASYNC_OPERATION)
 *
 * @example
 * ```typescript
 * await waitForLoadingToFinish()
 * ```
 */
export const waitForLoadingToFinish = async (
  timeout: number = TEST_TIMEOUTS.ASYNC_OPERATION
) => {
  await waitFor(
    () => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    },
    { timeout }
  );
};

/**
 * Wait for a specific element to disappear from the document
 *
 * @param queryFn - Function that queries for the element
 * @param timeout - Custom timeout (defaults to ASYNC_OPERATION)
 *
 * @example
 * ```typescript
 * await waitForElementToDisappear(() => screen.queryByTestId('modal'))
 * ```
 */
export const waitForElementToDisappear = async (
  queryFn: () => HTMLElement | null,
  timeout: number = TEST_TIMEOUTS.ASYNC_OPERATION
) => {
  await waitFor(
    () => {
      expect(queryFn()).not.toBeInTheDocument();
    },
    { timeout }
  );
};

/**
 * Find an element by text with a custom timeout
 *
 * Wrapper around screen.findByText with standard timeout.
 *
 * @param text - Text to search for
 * @param timeout - Custom timeout (defaults to NETWORK_REQUEST)
 * @returns Promise that resolves to the element
 *
 * @example
 * ```typescript
 * const button = await findByTextWithTimeout('Submit')
 * ```
 */
export const findByTextWithTimeout = async (
  text: string | RegExp,
  timeout: number = TEST_TIMEOUTS.NETWORK_REQUEST
) => {
  return screen.findByText(text, {}, { timeout });
};

/**
 * Wait for an async operation to complete
 *
 * Generic helper for waiting with a standard timeout.
 *
 * @param assertion - Assertion function to wait for
 * @param timeout - Custom timeout (defaults to ASYNC_OPERATION)
 *
 * @example
 * ```typescript
 * await waitForAsyncOperation(() => {
 *   expect(mockFn).toHaveBeenCalled()
 * })
 * ```
 */
export const waitForAsyncOperation = async (
  assertion: () => void,
  timeout: number = TEST_TIMEOUTS.ASYNC_OPERATION
) => {
  await waitFor(assertion, { timeout });
};

/**
 * Get all list items and find one containing specific text
 *
 * Useful for finding specific items in lists where the text might
 * be nested deep in the component tree.
 *
 * @param text - Text to search for within list items
 * @returns The list item element or undefined
 *
 * @example
 * ```typescript
 * const clusterItem = await findListItemByText('my-cluster')
 * expect(clusterItem).toHaveTextContent('Active')
 * ```
 */
export const findListItemByText = async (text: string | RegExp) => {
  const listItems = await screen.findAllByRole('listitem');
  return listItems.find((item) => {
    const textContent = item.textContent || '';
    return typeof text === 'string'
      ? textContent.includes(text)
      : text.test(textContent);
  });
};
