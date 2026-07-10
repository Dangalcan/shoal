import { useAppUpdates } from './useAppUpdates';

/** Headless component that wires app-update notifications. Render once. */
export function AppUpdateNotifier() {
  useAppUpdates();
  return null;
}
