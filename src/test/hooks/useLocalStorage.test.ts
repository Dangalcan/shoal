import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useLocalStorage', () => {
  const key = 'test-key';
  const initialValue = { foo: 'bar' };

  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('should use initial value if localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage(key, initialValue));
    expect(result.current[0]).toEqual(initialValue);
  });

  it('should load value from localStorage if exists', () => {
    const savedValue = { foo: 'baz' };
    window.localStorage.setItem(key, JSON.stringify(savedValue));

    const { result } = renderHook(() => useLocalStorage(key, initialValue));
    expect(result.current[0]).toEqual(savedValue);
  });

  it('should update value and save to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage(key, initialValue));

    const newValue = { foo: 'updated' };
    act(() => {
      result.current[1](newValue);
    });

    expect(result.current[0]).toEqual(newValue);
    expect(window.localStorage.getItem(key)).toBe(JSON.stringify(newValue));
  });

  it('should handle functional updates', () => {
    const { result } = renderHook(() => useLocalStorage<number>('count', 0));

    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(1);
    expect(window.localStorage.getItem('count')).toBe('1');
  });

  it('should handle JSON parse errors and return initial value', () => {
    window.localStorage.setItem(key, 'invalid-json');
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useLocalStorage(key, initialValue));

    expect(result.current[0]).toEqual(initialValue);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Error reading localStorage'),
      expect.anything()
    );
    spy.mockRestore();
  });

  it('should handle window.localStorage.setItem errors', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setItemSpy = vi
      .spyOn(window.localStorage.__proto__, 'setItem')
      .mockImplementation(() => {
        throw new Error('Quota exceeded');
      });

    const { result } = renderHook(() => useLocalStorage(key, initialValue));

    act(() => {
      result.current[1]({ data: 'too big' });
    });

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Error setting localStorage'),
      expect.anything()
    );

    spy.mockRestore();
    setItemSpy.mockRestore();
  });

  it('should handle undefined window (SSR environment)', () => {
    const { result } = renderHook(() => {
      const oldWindow = globalThis.window;
      Object.defineProperty(globalThis, 'window', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      try {
        return useLocalStorage('ssr-key', { foo: 'ssr' });
      } finally {
        Object.defineProperty(globalThis, 'window', {
          value: oldWindow,
          writable: true,
          configurable: true,
        });
      }
    });

    expect(result.current[0]).toEqual({ foo: 'ssr' });
  });
});
