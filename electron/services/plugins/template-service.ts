/**
 * Template Service
 *
 * Scaffolds new plugin projects with boilerplate code.
 */

import fs from 'fs/promises';
import path from 'path';

// Text that is safe inside a generated block comment: one line, and no
// comment terminator.
function commentText(value: string): string {
  return value.replace(/\*\//g, '* /').replace(/[\r\n]+/g, ' ');
}

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

    // User-supplied text only reaches the generated code as JSON string
    // literals or sanitized comments, never spliced into code or HTML.
    const nameLiteral = JSON.stringify(options.name);
    const nameComment = commentText(options.name);

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
 * ${nameComment} - Plugin Entry Point
 */

const PLUGIN_NAME = ${nameLiteral};

// The context handed to activate() is the plugin's logger and API; keep it
// for deactivate(), which receives no arguments.
let activeContext = null;

module.exports = {
  /**
   * Called when the plugin is enabled or the app starts.
   */
  activate: (context) => {
    activeContext = context;
    context.logger.info(PLUGIN_NAME + ' activated');

    // Register a notification
    context.ui.showNotification(PLUGIN_NAME + ' is ready!', 'info');
    
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
    if (activeContext) activeContext.logger.info(PLUGIN_NAME + ' deactivated');
    activeContext = null;
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
 * ${nameComment} - Renderer (sandboxed UI)
 *
 * Runs in an isolated iframe. Use window.k8sPlugin for all host access:
 *   - k8sPlugin.kubernetes.*   (reads need "kubernetes"; deleteResource and
 *       manifests.* need "kubernetes:write"; helm.* needs "helm"; Secret
 *       data needs "secrets")
 *   - k8sPlugin.settings.get/set  (this plugin's own settings)
 *   - k8sPlugin.ui.openExternal / showNotification  (requires "ui")
 *   - k8sPlugin.ui.showModal(id, props) / closeModal  (requires "ui";
 *       register the modal component by id in your renderer first)
 *   - k8sPlugin.ui.setTitle / setHeight
 *   - k8sPlugin.ready()  (call once mounted)
 *
 * Build the DOM with textContent (never innerHTML) for anything that comes
 * from the cluster or the user.
 */
(async function () {
  const api = window.k8sPlugin;
  const root = document.getElementById('root');
  const PLUGIN_NAME = ${nameLiteral};

  const el = (tag, text) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };

  api.ui.setTitle(PLUGIN_NAME);

  try {
    const context = await api.kubernetes.getCurrentContext();
    const button = el('button', 'Refresh pods');
    const out = el('pre');
    root.replaceChildren(
      el('h1', PLUGIN_NAME),
      el('p', 'Current context: ' + (context || 'none')),
      button,
      out
    );

    button.addEventListener('click', async () => {
      out.textContent = 'Loading...';
      try {
        const pods = await api.kubernetes.getPods(context);
        out.textContent = 'Pods: ' + (Array.isArray(pods) ? pods.length : 0);
      } catch (err) {
        out.textContent = 'Error: ' + err.message;
      }
    });
  } catch (err) {
    root.replaceChildren(el('p', 'Failed to initialise: ' + err.message));
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
