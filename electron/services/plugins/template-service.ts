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
      renderer: 'renderer.js',
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

    // 3. Create renderer.js — the sandboxed UI bundle.
    //
    // The renderer runs inside an isolated iframe (opaque origin, no
    // window.electron). Its ONLY capability surface is `window.k8sPlugin`,
    // a promise-based, permission-gated API. The plugin owns its rendering:
    // mount into #root with any framework, or plain DOM as shown here.
    const rendererJs = `
/**
 * ${options.name} - Renderer (sandboxed UI)
 *
 * Runs in an isolated iframe. Use window.k8sPlugin for all host access:
 *   - k8sPlugin.kubernetes.*   (requires "kubernetes" permission)
 *   - k8sPlugin.settings.get/set  (this plugin's own settings)
 *   - k8sPlugin.ui.openExternal / showNotification  (requires "ui")
 *   - k8sPlugin.ui.setTitle / setHeight
 *   - k8sPlugin.ready()  (call once mounted)
 */
(async function () {
  const api = window.k8sPlugin;
  const root = document.getElementById('root');

  api.ui.setTitle('${options.name}');

  try {
    const context = await api.kubernetes.getCurrentContext();
    root.innerHTML =
      '<h1>${options.name}</h1>' +
      '<p>Current context: <strong>' + (context || 'none') + '</strong></p>' +
      '<button id="refresh">Refresh pods</button>' +
      '<pre id="out"></pre>';

    document.getElementById('refresh').addEventListener('click', async () => {
      const out = document.getElementById('out');
      out.textContent = 'Loading...';
      try {
        const pods = await api.kubernetes.getPods(context);
        out.textContent = 'Pods: ' + (Array.isArray(pods) ? pods.length : 0);
      } catch (err) {
        out.textContent = 'Error: ' + err.message;
      }
    });
  } catch (err) {
    root.innerHTML = '<p>Failed to initialise: ' + err.message + '</p>';
  }

  api.ready();
})();
`.trim();

    await fs.writeFile(
      path.join(targetDir, 'renderer.js'),
      rendererJs,
      'utf-8'
    );
  }
}

export const templateService = new TemplateService();
