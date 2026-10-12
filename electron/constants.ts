export const LICENSE = {
  TRIAL_DURATION_DAYS: 14,
  GRACE_PERIOD_DAYS: 7,
  REVERIFICATION_INTERVAL_HOURS: 24,
  OFFLINE_TOKEN_PREFIX: 'OFFLINE-ACTIVATED-',
} as const;

/**
 * Example plugins shipped with the app (package.json build.extraResources).
 * They are enabled on first run; afterwards the user's choice in
 * plugin-config.json wins.
 */
export const BUNDLED_DEFAULT_ENABLED: readonly string[] = [
  'namespace-watcher',
  'resource-monitor',
];

/** The public repository: the Help menu, the About box and issue links. */
export const REPO_URL = 'https://github.com/Dangalcan/shoal';
