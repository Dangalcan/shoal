import { describe, it, expect, vi, beforeEach } from 'vitest';
import log from '../logger';
import {
  loadNodePty,
  resetNodePtyForTests,
} from '../services/terminal/node-pty-loader';

vi.mock('../logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// The real module: on Windows the package ships its prebuild, so the load
// succeeds; on Linux without `npm run rebuild:node-pty` there is no binary
// and node-pty throws at require time, which is the fallback case.
describe('node-pty-loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNodePtyForTests();
  });

  it('tries once and caches the outcome, logging it a single time', () => {
    const first = loadNodePty();
    const second = loadNodePty();

    expect(second).toBe(first);
    if (first) {
      expect(typeof first.spawn).toBe('function');
      expect(log.info).toHaveBeenCalledTimes(1);
      expect(log.warn).not.toHaveBeenCalled();
    } else {
      expect(log.info).not.toHaveBeenCalled();
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('local shells run over pipes'),
        expect.any(String)
      );
    }
  });

  it.skipIf(process.platform !== 'win32')(
    'loads the Windows x64 prebuild that ships in the package',
    () => {
      expect(loadNodePty()).not.toBeNull();
    }
  );
});
