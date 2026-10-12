/**
 * Window state
 *
 * Remembers the main window's size, position and maximized state between
 * launches, and refuses to restore bounds that no connected display shows
 * any more (a monitor that was unplugged, a resolution that shrank).
 */

import type { BrowserWindow, Rectangle } from 'electron';

export interface WindowState {
  bounds?: Rectangle;
  maximized?: boolean;
}

/** Pixels of the window that must stay inside some display to restore it. */
const MIN_VISIBLE_PX = 100;
const MIN_RESTORED_SIZE = 200;

/**
 * Returns the saved bounds when they are sane and at least a corner of
 * `MIN_VISIBLE_PX` by `MIN_VISIBLE_PX` lies inside one of the display work
 * areas; `undefined` otherwise, so the caller falls back to the defaults.
 */
export function usableBounds(
  saved: Rectangle | undefined,
  displays: Rectangle[]
): Rectangle | undefined {
  if (!saved) return undefined;
  const { x, y, width, height } = saved;
  const numbers = [x, y, width, height];
  if (!numbers.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return undefined;
  }
  if (width < MIN_RESTORED_SIZE || height < MIN_RESTORED_SIZE) return undefined;

  const visible = displays.some((d) => {
    const overlapX = Math.min(x + width, d.x + d.width) - Math.max(x, d.x);
    const overlapY = Math.min(y + height, d.y + d.height) - Math.max(y, d.y);
    return overlapX >= MIN_VISIBLE_PX && overlapY >= MIN_VISIBLE_PX;
  });
  return visible ? { x, y, width, height } : undefined;
}

/**
 * Follows a window and hands every change of its state to `save` (debounced
 * while the user drags or resizes, immediately when the window closes).
 * Bounds are only recorded while the window is in its normal state, so a
 * maximized or full-screen window restores to its last normal size.
 * Returns a function that stops tracking.
 */
export function trackWindowState(
  win: BrowserWindow,
  save: (state: WindowState) => void,
  debounceMs = 500
): () => void {
  const state: WindowState = {
    bounds: win.getBounds(),
    maximized: win.isMaximized(),
  };
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    save({ ...state });
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  };
  const onBoundsChange = () => {
    if (win.isMaximized() || win.isMinimized() || win.isFullScreen()) return;
    state.bounds = win.getBounds();
    schedule();
  };
  const onMaximize = () => {
    state.maximized = true;
    schedule();
  };
  const onUnmaximize = () => {
    state.maximized = false;
    schedule();
  };

  win.on('resize', onBoundsChange);
  win.on('move', onBoundsChange);
  win.on('maximize', onMaximize);
  win.on('unmaximize', onUnmaximize);
  win.on('close', flush);

  return () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    win.removeListener('resize', onBoundsChange);
    win.removeListener('move', onBoundsChange);
    win.removeListener('maximize', onMaximize);
    win.removeListener('unmaximize', onUnmaximize);
    win.removeListener('close', flush);
  };
}
