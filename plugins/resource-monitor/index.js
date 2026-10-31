/**
 * Resource Monitor Plugin
 *
 * Monitors pod restart counts per namespace and alerts when restarts exceed
 * the configured threshold since the last scan. Stores last-scan data in
 * plugin storage so spurious alerts don't fire after plugin reload.
 *
 * When metrics-server is available, also monitors real CPU usage and alerts
 * when a pod exceeds the configured percentage of its CPU limit.
 */

let interval;
// The context handed to activate(): deactivate() receives none, so the
// logger is kept here (see the plugin scaffold in template-service.ts).
let activeContext = null;

/** "250m" → 250 millicores; "1" → 1000; undefined → 0. */
function cpuLimitToMillicores(v) {
  if (!v) return 0;
  if (String(v).endsWith('m')) return parseInt(v, 10) || 0;
  const cores = parseFloat(v);
  return Number.isFinite(cores) ? Math.round(cores * 1000) : 0;
}

/** Sum of container CPU limits for a pod, in millicores (0 = no limits). */
function podCpuLimitMillicores(pod) {
  return (pod.spec?.containers ?? []).reduce(
    (sum, c) => sum + cpuLimitToMillicores(c.resources?.limits?.cpu),
    0
  );
}

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

    activeContext = context;
    context.logger.info('Resource Monitor activating...');

    const settings = (await context.storage.get('settings')) || {};
    const refreshRate = settings.refreshRate || 10000;
    const excludedNS = new Set(
      settings.excludedNamespaces || ['kube-system', 'kube-public']
    );
    const restartThreshold = settings.restartThreshold ?? 3;
    const cpuAlertThreshold = settings.alertThreshold ?? 80;
    const notifyOnAlert = settings.notifyOnAlert !== false;

    // Deduped notification helper (falls back on older app builds)
    const notifyOnce =
      typeof context.ui.notifyOnce === 'function'
        ? context.ui.notifyOnce.bind(context.ui)
        : (_key, msg, level) => context.ui.showNotification(msg, level);

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

        // Real CPU usage vs limits (metrics-server; [] when unavailable)
        if (typeof context.kubernetes.getPodMetrics === 'function') {
          try {
            const metrics = await context.kubernetes.getPodMetrics('all');
            const limitByKey = {};
            for (const pod of filtered) {
              const limit = podCpuLimitMillicores(pod);
              if (limit > 0) {
                const ns = pod.metadata?.namespace ?? 'default';
                limitByKey[`${ns}/${pod.metadata?.name}`] = limit;
              }
            }
            for (const m of metrics) {
              const key = `${m.namespace}/${m.name}`;
              const limit = limitByKey[key];
              if (!limit) continue; // no CPU limit → percentage is undefined
              const pct = Math.round((m.cpuMillicores / limit) * 100);
              if (pct >= cpuAlertThreshold) {
                context.logger.warn(
                  `Pod ${key} at ${pct}% of its CPU limit (${m.cpuMillicores}m / ${limit}m)`
                );
                if (notifyOnAlert) {
                  notifyOnce(
                    `cpu:${key}`,
                    `High CPU: ${m.name} (${m.namespace}) at ${pct}% of its limit`,
                    'warning',
                    15 * 60 * 1000
                  );
                }
              }
            }
          } catch (err) {
            context.logger.warn('CPU metrics check failed:', err.message);
          }
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
    // No "is now active" toast: bundled plugins start with the app.
  },

  // deactivate() receives no arguments (docs/PLUGINS_GUIDE.md): stop the
  // timer activate() started in this same module instance.
  deactivate: async () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    if (activeContext) activeContext.logger.info('Resource Monitor deactivated');
    activeContext = null;
  },
};
