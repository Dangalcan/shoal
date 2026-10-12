import type { KeyboardEvent } from 'react';

/**
 * Makes a clickable element usable from the keyboard: Enter and Space run
 * `action` the way a click would. Pair it with `role="button"` and
 * `tabIndex={0}` on elements that are not buttons:
 * `onKeyDown={(e) => activateOnKey(e, open)}`.
 */
export function activateOnKey<T extends Element>(
  event: KeyboardEvent<T>,
  action: () => void
): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
}
