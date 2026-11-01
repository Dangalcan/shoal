import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { EventEmitter } from 'events';
import type { BrowserWindow, Rectangle } from 'electron';
import { usableBounds, trackWindowState } from '../window-state';
import type { WindowState } from '../window-state';

const laptop: Rectangle = { x: 0, y: 0, width: 1920, height: 1080 };
const secondScreen: Rectangle = { x: 1920, y: 0, width: 2560, height: 1440 };

describe('usableBounds', () => {
  it('returns nothing when nothing was saved', () => {
    expect(usableBounds(undefined, [laptop])).toBeUndefined();
  });

  it('restores bounds that lie on a display', () => {
    const saved = { x: 100, y: 50, width: 1200, height: 800 };
    expect(usableBounds(saved, [laptop])).toEqual(saved);
  });

  it('restores bounds on a second display', () => {
    const saved = { x: 2000, y: 100, width: 1200, height: 800 };
    expect(usableBounds(saved, [laptop, secondScreen])).toEqual(saved);
  });

  it('drops bounds that were on a display that is gone', () => {
    const saved = { x: 2000, y: 100, width: 1200, height: 800 };
    expect(usableBounds(saved, [laptop])).toBeUndefined();
  });

  it('drops bounds that only touch a display by a sliver', () => {
    const saved = { x: 1900, y: 50, width: 1200, height: 800 };
    expect(usableBounds(saved, [laptop])).toBeUndefined();
  });

  it('drops absurd or corrupt values', () => {
    expect(
      usableBounds({ x: 0, y: 0, width: 50, height: 800 }, [laptop])
    ).toBeUndefined();
    expect(
      usableBounds(
        { x: Number.NaN, y: 0, width: 1200, height: 800 } as Rectangle,
        [laptop]
      )
    ).toBeUndefined();
    expect(
      usableBounds(
        { x: '10', y: 0, width: 1200, height: 800 } as unknown as Rectangle,
        [laptop]
      )
    ).toBeUndefined();
  });
});

class FakeWindow extends EventEmitter {
  bounds: Rectangle = { x: 10, y: 20, width: 1200, height: 800 };
  maximized = false;
  minimized = false;
  fullScreen = false;
  getBounds() {
    return { ...this.bounds };
  }
  isMaximized() {
    return this.maximized;
  }
  isMinimized() {
    return this.minimized;
  }
  isFullScreen() {
    return this.fullScreen;
  }
}

describe('trackWindowState', () => {
  let win: FakeWindow;
  let save: Mock<(state: WindowState) => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    win = new FakeWindow();
    save = vi.fn<(state: WindowState) => void>();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const track = () =>
    trackWindowState(win as unknown as BrowserWindow, save, 500);

  it('saves the bounds once the user stops resizing', () => {
    track();
    win.bounds = { x: 10, y: 20, width: 1300, height: 850 };
    win.emit('resize');
    win.bounds = { x: 10, y: 20, width: 1400, height: 900 };
    win.emit('resize');
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({
      bounds: { x: 10, y: 20, width: 1400, height: 900 },
      maximized: false,
    });
  });

  it('keeps the normal bounds while the window is maximized or full screen', () => {
    track();
    win.maximized = true;
    win.bounds = { x: 0, y: 0, width: 1920, height: 1040 };
    win.emit('maximize');
    win.emit('resize');
    vi.advanceTimersByTime(500);
    expect(save).toHaveBeenLastCalledWith({
      bounds: { x: 10, y: 20, width: 1200, height: 800 },
      maximized: true,
    });

    win.maximized = false;
    win.fullScreen = true;
    win.emit('unmaximize');
    win.emit('resize');
    vi.advanceTimersByTime(500);
    expect(save).toHaveBeenLastCalledWith({
      bounds: { x: 10, y: 20, width: 1200, height: 800 },
      maximized: false,
    });
  });

  it('flushes immediately when the window closes', () => {
    track();
    win.bounds = { x: 5, y: 5, width: 1000, height: 700 };
    win.emit('move');
    win.emit('close');
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({
      bounds: { x: 5, y: 5, width: 1000, height: 700 },
      maximized: false,
    });
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('saves the initial state when the window closes untouched', () => {
    win.maximized = true;
    track();

    win.emit('close');

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({
      bounds: { x: 10, y: 20, width: 1200, height: 800 },
      maximized: true,
    });
  });

  it('ignores bounds changes while the window is minimized', () => {
    track();
    win.minimized = true;
    win.bounds = { x: -32000, y: -32000, width: 160, height: 28 };
    win.emit('move');

    vi.advanceTimersByTime(1000);
    expect(save).not.toHaveBeenCalled();
  });

  it('drops a pending save when disposed mid-debounce', () => {
    const dispose = track();
    win.bounds = { x: 50, y: 60, width: 900, height: 600 };
    win.emit('resize');

    dispose();
    vi.advanceTimersByTime(1000);

    expect(save).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops listening once disposed', () => {
    const dispose = track();
    dispose();
    win.emit('resize');
    win.emit('close');
    vi.advanceTimersByTime(1000);
    expect(save).not.toHaveBeenCalled();
    expect(win.listenerCount('resize')).toBe(0);
  });
});
