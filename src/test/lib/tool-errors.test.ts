import { describe, it, expect } from 'vitest';
import { isToolMissingMessage } from '../../lib/tool-errors';

describe('isToolMissingMessage', () => {
  it('recognises the message safe-exec produces for a missing tool', () => {
    expect(
      isToolMissingMessage('kubectl is not installed or not on the PATH')
    ).toBe(true);
    expect(
      isToolMissingMessage('  kind is not installed or not on the PATH\n')
    ).toBe(true);
  });

  it('ignores other failures and empty values', () => {
    expect(isToolMissingMessage('kubectl: connection refused')).toBe(false);
    expect(isToolMissingMessage('kubectl did not answer in time')).toBe(false);
    expect(isToolMissingMessage('')).toBe(false);
    expect(isToolMissingMessage(null)).toBe(false);
    expect(isToolMissingMessage(undefined)).toBe(false);
  });
});
