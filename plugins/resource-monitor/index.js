/**
 * Resource Monitor Plugin
 *
 * Demonstrates:
 * 1. Dependencies (requires namespace-watcher)
 * 2. Array configuration properties
 * 3. Listening to app events
 */

let interval;

module.exports = {
  activate: async (context) => {
    context.logger.info('Resource Monitor activating...');

    // Get settings
    const settings = (await context.storage.get('settings')) || {};
    const refreshRate = settings.refreshRate || 10000;
    const excludedNS = settings.excludedNamespaces || ['kube-system'];

    context.logger.info(`Monitoring with refresh rate: ${refreshRate}ms`);
    context.logger.info(`Excluded namespaces: ${excludedNS.join(', ')}`);

    // Register a sidebar item
    context.ui.registerSidebarItem({
      id: 'resource-monitor-link',
      label: 'Pod Monitor',
      icon: 'activity',
      route: '/plugin/resource-monitor',
      order: 110,
    });

    // Listen to resource events
    context.events.onResourceCreated((resource) => {
      if (resource.kind === 'Pod') {
        context.logger.info(
          `New Pod detected in app: ${resource.metadata.name}`
        );
        if (settings.notifyOnAlert) {
          context.ui.showNotification(
            `New Pod started: ${resource.metadata.name}`,
            'info'
          );
        }
      }
    });

    // Start monitoring loop
    interval = setInterval(async () => {
      try {
        const pods = await context.kubernetes.getResources('pods', 'all');
        const count = pods.length;
        context.logger.info(`Currently tracking ${count} pods`);
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
    }
  },
};
