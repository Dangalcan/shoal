import type { Plugin } from '../../../electron/types/plugin-types';

/**
 * Ownership state of a marketplace entry for the current user, derived from
 * the locally installed plugin (licenses are activated at install time, so an
 * entry that is not installed has no ownership record).
 */
export type OwnershipState =
  | 'none'
  | 'installed'
  | 'licensed'
  | 'trial'
  | 'expired';

export function getOwnershipState(
  plugin: Plugin | undefined,
  isPaid: boolean
): OwnershipState {
  if (!plugin) return 'none';
  if (plugin.state === 'expired') return 'expired';
  if (plugin.state === 'trial' || plugin.licenseInfo?.isTrialActive)
    return 'trial';
  if (isPaid && plugin.licenseInfo?.isActive) return 'licensed';
  return 'installed';
}

/** Human date for license/trial expiry lines, or undefined when absent. */
export function formatExpiry(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString();
}
