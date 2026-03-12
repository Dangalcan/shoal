/**
 * Resource Monitor Plugin
 *
 * Monitors pod restart counts per namespace and alerts when restarts exceed
 * the configured threshold since the last scan. Stores last-scan data in
 * plugin storage so spurious alerts don't fire after plugin reload.
 */

let interval;

/**
 * Build a map of { "namespace/podName": restartCount } from a pods list.
 * restartCount = sum of all container restartCounts in the pod status.
 */
function buildRestartMap(pods) {
  const map = {};
  for (const pod of pods) {
    const ns = pod.metadata?.namespace ?? 'default';
    const name = pod.metadata?.name ?? 'unknown';
    const containers = pod.status?.containerStatuses ?? [];
    const restarts = containers.reduce(
      (sum, c) => sum + (c.restartCount ?? 0),
      0
    );
    map[`${ns}/${name}`] = restarts;
  }
  return map;
}

module.exports = {
  activate: async (context) => {
    // Guard against interval stacking if activate is called without a prior deactivate
    if (interval) {
      clearInterval(interval);
      interval = null;
    }

    context.logger.info('Resource Monitor activating...');

    const settings = (await context.storage.get('settings')) || {};
    const refreshRate = settings.refreshRate || 10000;
    const excludedNS = new Set(
      settings.excludedNamespaces || ['kube-system', 'kube-public']
    );
    const restartThreshold = settings.restartThreshold ?? 3;
    const notifyOnAlert = settings.notifyOnAlert !== false;

    context.logger.info(
      `Refresh: ${refreshRate}ms | Excluded NS: ${[...excludedNS].join(', ')} | Restart threshold: ${restartThreshold}`
    );

    context.ui.registerSidebarItem({
      id: 'resource-monitor-link',
      label: 'Pod Monitor',
      icon: 'activity',
      route: '/plugin/resource-monitor',
      order: 110,
    });

    // Load previous restart counts to detect new restarts since last scan
    let prevRestartMap = (await context.storage.get('last-scan')) || {};

    // Track per-pod last-alerted time to suppress duplicate alerts within a cooldown window
    const lastAlertedAt = {};
    const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes per pod

    context.events.onResourceCreated((resource) => {
      if (resource.kind === 'Pod' && notifyOnAlert) {
        const ns = resource.metadata?.namespace ?? '';
        if (!excludedNS.has(ns)) {
          context.ui.showNotification(
            `New Pod started: ${resource.metadata.name} (${ns})`,
            'info'
          );
        }
      }
    });

    interval = setInterval(async () => {
      try {
        const pods = await context.kubernetes.getResources('pods', 'all');

        // Filter excluded namespaces
        const filtered = pods.filter(
          (p) => !excludedNS.has(p.metadata?.namespace ?? '')
        );

        const currentMap = buildRestartMap(filtered);
        const now = Date.now();

        // Detect pods whose restart count increased beyond threshold since last scan
        const alertedPods = [];
        for (const [key, current] of Object.entries(currentMap)) {
          const prev = prevRestartMap[key] ?? 0;
          const delta = current - prev;
          if (delta >= restartThreshold) {
            const [ns, podName] = key.split('/');
            context.logger.warn(
              `Pod ${podName} in ${ns} restarted ${delta} time(s) (total: ${current})`
            );
            // Only alert if outside the cooldown window for this pod
            if (
              !lastAlertedAt[key] ||
              now - lastAlertedAt[key] >= ALERT_COOLDOWN_MS
            ) {
              alertedPods.push({ podName, ns, delta, total: current });
              lastAlertedAt[key] = now;
            }
          }
        }

        if (alertedPods.length > 0 && notifyOnAlert) {
          const summary = alertedPods
            .map(({ podName, ns, delta }) => `${podName} (${ns}): +${delta}`)
            .join(', ');
          context.ui.showNotification(
            `High restart count detected: ${summary}`,
            'warning'
          );
        }

        // Group by namespace for summary log
        const byNS = {};
        for (const pod of filtered) {
          const ns = pod.metadata?.namespace ?? 'default';
          byNS[ns] = (byNS[ns] || 0) + 1;
        }
        const nsSummary = Object.entries(byNS)
          .map(([ns, count]) => `${ns}:${count}`)
          .join(', ');
        context.logger.info(`Pods by namespace — ${nsSummary || 'none'}`);

        // Persist current restart map as the new baseline.
        // currentMap only contains currently-running pods, so deleted pods are automatically pruned.
        prevRestartMap = currentMap;
        await context.storage.set('last-scan', currentMap);
      } catch (err) {
        context.logger.error('Failed to fetch pods:', err.message);
      }
    }, refreshRate);

    context.ui.showNotification('Resource Monitor is now active!', 'success');
  },

  deactivate: async (context) => {
    context.logger.info('Resource Monitor deactivating...');
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  },
};
