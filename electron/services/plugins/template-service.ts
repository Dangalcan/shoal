/**
 * Template Service
 *
 * Scaffolds new plugin projects with boilerplate code.
 */

import fs from 'fs/promises';
import path from 'path';

export class TemplateService {
  /**
   * Create a new plugin from a template.
   */
  async scaffoldPlugin(
    targetDir: string,
    options: {
      id: string;
      name: string;
      author: string;
      description: string;
    }
  ): Promise<void> {
    await fs.mkdir(targetDir, { recursive: true });

    // 1. Create plugin.json
    const manifest = {
      id: options.id,
      name: options.name,
      version: '1.0.0',
      description: options.description,
      author: options.author,
      main: 'index.js',
      permissions: ['ui', 'kubernetes'],
      license: {
        type: 'free',
        spdx: 'MIT',
      },
      extensions: {
        sidebar: [
          {
            id: `${options.id}-page`,
            label: options.name,
            route: `/plugin/${options.id}`,
          },
        ],
      },
      configuration: {
        title: 'Settings',
        properties: {
          enableFeatureX: {
            type: 'boolean',
            label: 'Enable Feature X',
            default: true,
          },
        },
      },
    };

    await fs.writeFile(
      path.join(targetDir, 'plugin.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    // 2. Create index.js
    const indexJs = `
/**
 * ${options.name} - Plugin Entry Point
 */

module.exports = {
  /**
   * Called when the plugin is enabled or the app starts.
   */
  activate: (context) => {
    context.logger.info('${options.name} activated');
    
    // Register a notification
    context.ui.showNotification('${options.name} is ready!', 'info');
    
    // Example: Watch for pods (if permitted)
    // context.kubernetes.watchResources('pods', (event) => {
    //   context.logger.debug('Pod event:', event.type, event.object.metadata.name);
    // });
  },

  /**
   * Called when the plugin is disabled.
   * Clean up timers, event listeners, or watchers here.
   */
  deactivate: () => {
    console.log('${options.name} deactivated');
  }
};
`.trim();

    await fs.writeFile(path.join(targetDir, 'index.js'), indexJs, 'utf-8');
  }
}

export const templateService = new TemplateService();
