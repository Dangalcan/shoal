/**
 * Hello World Plugin - entry point
 */

module.exports = {
  /**
   * Called when the plugin is activated
   */
  activate: (context) => {
    context.logger.info('Hello World plugin activated!');

    // Register a simple sidebar item
    context.ui.registerSidebarItem({
      id: 'hello-world-item',
      label: 'Hello!',
      route: '/plugin/hello-world',
    });

    // Show a welcome notification
    context.ui.showNotification('Welcome to the Plugin System!', 'info');
  },

  /**
   * Called when the plugin is deactivated
   */
  deactivate: () => {
    console.log('Hello World plugin deactivated');
  },
};
