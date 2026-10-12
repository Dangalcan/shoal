import { describe, it, expect, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import { activateOnKey } from '../../lib/a11y';

function keyEvent(key: string) {
  return { key, preventDefault: vi.fn() } as unknown as KeyboardEvent<Element>;
}

describe('activateOnKey', () => {
  it('runs the action on Enter and Space and swallows the key', () => {
    const action = vi.fn();
    const enter = keyEvent('Enter');
    const space = keyEvent(' ');
    activateOnKey(enter, action);
    activateOnKey(space, action);
    expect(action).toHaveBeenCalledTimes(2);
    expect(enter.preventDefault).toHaveBeenCalled();
    expect(space.preventDefault).toHaveBeenCalled();
  });

  it('ignores other keys', () => {
    const action = vi.fn();
    const tab = keyEvent('Tab');
    activateOnKey(tab, action);
    expect(action).not.toHaveBeenCalled();
    expect(tab.preventDefault).not.toHaveBeenCalled();
  });
});
