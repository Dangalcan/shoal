/**
 * Namespace Watcher Plugin
 *
 * Demonstrates Phase 1 enhancements:
 * - Lifecycle hooks (beforeActivate, activate, afterActivate, etc.)
 * - Event subscriptions (cluster connected, resource events)
 * - Data loading (default-config.json)
 * - Configuration schema (in plugin.json)
 */

let refreshInterval = null;

module.exports = {
  /**
   * Before activation hook
   * Runs before the plugin is activated
   */
  beforeActivate: async (context) => {
    context.logger.info('Preparing Namespace Watcher...');

    // Check if data was loaded
    const defaultConfig = await context.storage.get('data/data/default-config');
    if (defaultConfig) {
      context.logger.info('Default configuration loaded:', defaultConfig);
    }
  },

  /**
   * Main activation hook
   * Runs when the plugin is activated
   */
  activate: async (context) => {
    context.logger.info('Namespace Watcher starting up...');

    // Load default configuration (data file bundled with the plugin)
    const defaultConfig =
      (await context.storage.get('data/data/default-config')) || {};
    const systemNamespaces = defaultConfig.defaultNamespaces || ['default'];
    const systemNamespacePrefixes = defaultConfig.systemNamespacePrefixes || [
      'kube-',
    ];
    const sidebarConfig = defaultConfig.sidebar || {
      id: 'ns-watcher-summary',
      icon: 'eye',
      route: '/plugin/namespace-watcher',
      order: 100,
    };

    // Load settings
    const settings = (await context.storage.get('settings')) || {};
    const refreshIntervalSeconds = settings.refreshInterval || 30;
    const showSystemNamespaces = settings.showSystemNamespaces ?? false;
    const alertThreshold = settings.alertThreshold || 50;
    const notificationLevel = settings.notificationLevel || 'important';

    context.logger.info('Settings:', {
      refreshIntervalSeconds,
      showSystemNamespaces,
      alertThreshold,
      notificationLevel,
    });

    // Bundle config into a single object to pass around
    const config = {
      showSystemNamespaces,
      alertThreshold,
      notificationLevel,
      systemNamespaces,
      systemNamespacePrefixes,
      sidebarConfig,
    };

    // Subscribe to cluster events
    context.events.onClusterConnected(async (cluster) => {
      context.logger.info(`Connected to cluster: ${cluster.name || 'unknown'}`);

      if (notificationLevel !== 'none') {
        context.ui.showNotification(
          `Namespace Watcher: Monitoring cluster ${cluster.name || 'unknown'}`,
          'info'
        );
      }

      await refreshNamespaces(context, config);
    });

    context.events.onClusterDisconnected(async (cluster) => {
      context.logger.info(
        `Disconnected from cluster: ${cluster.name || 'unknown'}`
      );

      if (notificationLevel !== 'none') {
        context.ui.showNotification(
          `Namespace Watcher: Stopped monitoring cluster ${cluster.name || 'unknown'}`,
          'warning'
        );
      }
    });

    // Subscribe to resource events
    context.events.onResourceCreated(async (resource) => {
      if (resource.kind === 'Namespace') {
        context.logger.info(
          `New namespace created: ${resource.metadata?.name}`
        );

        if (notificationLevel === 'all' || notificationLevel === 'important') {
          context.ui.showNotification(
            `New namespace created: ${resource.metadata?.name}`,
            'success'
          );
        }

        await refreshNamespaces(context, config);
      }
    });

    context.events.onResourceDeleted(async (resource) => {
      if (resource.type === 'namespaces') {
        context.logger.info(`Namespace deleted: ${resource.name}`);

        if (notificationLevel === 'all' || notificationLevel === 'important') {
          context.ui.showNotification(
            `Namespace deleted: ${resource.name}`,
            'warning'
          );
        }

        await refreshNamespaces(context, config);
      }
    });

    // Initial load
    await refreshNamespaces(context, config);

    // Set up periodic refresh
    refreshInterval = setInterval(async () => {
      try {
        await refreshNamespaces(context, config);
      } catch (error) {
        context.logger.error('Failed to refresh namespaces:', error);
      }
    }, refreshIntervalSeconds * 1000);

    context.logger.info(
      `Refresh interval set to ${refreshIntervalSeconds} seconds`
    );
  },

  /**
   * After activation hook
   * Runs after the plugin is fully activated
   */
  afterActivate: async (context) => {
    context.logger.info('Namespace Watcher fully activated and monitoring');

    context.ui.showNotification('Namespace Watcher is now active', 'success');
  },

  /**
   * Before deactivation hook
   * Runs before the plugin is deactivated
   */
  beforeDeactivate: async (context) => {
    context.logger.info('Preparing to deactivate Namespace Watcher...');

    // Save last sync time
    await context.storage.set('lastDeactivated', new Date().toISOString());
  },

  /**
   * Main deactivation hook
   * Runs when the plugin is deactivated
   */
  deactivate: async () => {
    console.log('Namespace Watcher deactivating...');

    // Clear interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
      console.log('Refresh interval cleared');
    }
  },

  /**
   * After deactivation hook
   * Runs after the plugin is fully deactivated
   */
  afterDeactivate: async () => {
    console.log('Namespace Watcher cleanup complete');
  },
};

/**
 * Helper function to refresh namespace data
 */
async function refreshNamespaces(context, config) {
  const {
    showSystemNamespaces,
    alertThreshold,
    notificationLevel,
    systemNamespaces,
    systemNamespacePrefixes,
    sidebarConfig,
  } = config;
  try {
    const namespaces = await context.kubernetes.getResources(
      'namespaces',
      'all'
    );

    // Filter system namespaces using configurable lists from default-config.json
    let filteredNamespaces = namespaces;
    if (!showSystemNamespaces) {
      filteredNamespaces = namespaces.filter((ns) => {
        const name = ns.metadata?.name || '';
        const isExact = systemNamespaces.includes(name);
        const isPrefix = systemNamespacePrefixes.some((p) =>
          name.startsWith(p)
        );
        return !isExact && !isPrefix;
      });
    }

    const count = filteredNamespaces.length;
    const totalCount = namespaces.length;

    context.logger.info(
      `Found ${count} namespaces (${totalCount} total, system: ${showSystemNamespaces})`
    );

    // Check alert threshold
    if (totalCount >= alertThreshold && notificationLevel === 'critical') {
      context.ui.showNotification(
        `Alert: ${totalCount} namespaces detected (threshold: ${alertThreshold})`,
        'warning'
      );
    }

    // Update sidebar using configuration from default-config.json
    context.ui.registerSidebarItem({
      id: sidebarConfig.id,
      label: `Namespaces (${count})`,
      icon: sidebarConfig.icon,
      route: sidebarConfig.route,
      order: sidebarConfig.order,
    });

    // Save to storage
    await context.storage.set('lastNamespaceCount', count);
    await context.storage.set('lastSync', new Date().toISOString());
  } catch (error) {
    context.logger.error('Failed to fetch namespaces:', error);

    if (notificationLevel !== 'none') {
      context.ui.showNotification('Failed to fetch namespaces', 'error');
    }
  }
}
