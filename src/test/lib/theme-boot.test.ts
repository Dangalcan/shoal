import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  applyInitialTheme,
  readInitialTheme,
  THEME_STORAGE_KEY,
} from '../../lib/theme-boot';

const storageWith = (value: string | null) => ({
  getItem: () => value,
});

describe('readInitialTheme', () => {
  it('prefers the saved theme over the system preference', () => {
    expect(readInitialTheme(storageWith('dark'), false)).toBe('dark');
    expect(readInitialTheme(storageWith('light'), true)).toBe('light');
  });

  it('falls back to the system preference without a valid saved theme', () => {
    expect(readInitialTheme(storageWith(null), true)).toBe('dark');
    expect(readInitialTheme(storageWith('purple'), false)).toBe('light');
    expect(readInitialTheme(undefined, true)).toBe('dark');
  });

  it('survives a storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
    };
    expect(readInitialTheme(broken, false)).toBe('light');
  });
});

describe('applyInitialTheme', () => {
  afterEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.removeAttribute('data-theme');
  });

  it('sets data-theme on the document before anything renders', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(applyInitialTheme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('defaults to light when nothing is saved and the system is light', () => {
    expect(applyInitialTheme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('follows the system when localStorage itself cannot be reached', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    vi.mocked(window.matchMedia).mockReturnValueOnce({
      matches: true,
    } as MediaQueryList);
    const storage = vi
      .spyOn(window, 'localStorage', 'get')
      .mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });

    try {
      expect(applyInitialTheme()).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    } finally {
      storage.mockRestore();
    }
  });
});
