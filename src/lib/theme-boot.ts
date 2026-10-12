/**
 * Applies the theme before React renders anything, so a user who chose the
 * dark theme never sees a light frame while the app mounts. `useTheme`
 * applies the same rule afterwards and keeps the attribute in sync.
 */

export type ThemeName = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

export function readInitialTheme(
  storage: Pick<Storage, 'getItem'> | undefined,
  prefersDark: boolean
): ThemeName {
  try {
    const saved = storage?.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage can be unavailable (privacy modes); fall through to the system.
  }
  return prefersDark ? 'dark' : 'light';
}

export function applyInitialTheme(doc: Document = document): ThemeName {
  const prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    storage = undefined;
  }
  const theme = readInitialTheme(storage, prefersDark);
  doc.documentElement.setAttribute('data-theme', theme);
  return theme;
}
