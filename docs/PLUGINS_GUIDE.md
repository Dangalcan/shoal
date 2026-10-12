# Shoal Plugin Developer Guide 🚀

This guide explains how to build, test, and distribute plugins for Shoal.

## Overview

Shoal uses a **Hybrid Plugin Architecture**.

- **Main Process**: Handle system-level tasks via Node.js.
- **Renderer Process**: Extend the UI with React components.

## Prerequisites

Before developing plugins, ensure you have:

- **Shoal** installed and running
- **Shoal running from source** (`git clone`, `npm install`, `npm run dev`; Node.js v22.12+). Only development builds load unsigned plugins
- **TypeScript** knowledge (recommended)
- **React** knowledge (for UI extensions)
- Basic understanding of Kubernetes concepts

## Development Setup

1.  **Run Shoal from source** with `npm run dev`. Development builds load unsigned plugins (`ALLOW_UNSIGNED_PLUGINS=true`); installed releases only load plugins signed with the Shoal key.
2.  **Create Plugin Directory**:
    - Windows: `%APPDATA%\Shoal\plugins\my-plugin\`
    - macOS: `~/Library/Application Support/Shoal/plugins/my-plugin/`
    - Linux: `~/.config/Shoal/plugins/my-plugin/`
3.  **Initialize Project**:
    ```bash
    mkdir my-plugin
    cd my-plugin
    npm init -y
    npm install --save-dev typescript @types/node
    ```

## Plugin Structure

A plugin is a directory containing at least two files:

```text
my-plugin/
├── plugin.json      # Metadata and configuration
└── index.js         # JavaScript entry point (Node.js)
```

### plugin.json Manifest

The `plugin.json` file defines the identity and capabilities of your plugin.

```json
{
  "id": "my-cool-plugin",
  "name": "My Cool Plugin",
  "version": "1.0.0",
  "description": "Adds awesome features to Shoal",
  "author": "Your Name",
  "main": "index.js",
  "renderer": "renderer.js",
  "permissions": ["kubernetes", "ui", "notifications"],
  "license": {
    "type": "free",
    "spdx": "MIT"
  },
  "extensions": {
    "sidebar": [
      {
        "id": "cool-page",
        "label": "Cool Features",
        "route": "/plugin/my-cool-plugin"
      }
    ]
  },
  "configuration": {
    "title": "Plugin Settings",
    "properties": {
      "apiKey": {
        "type": "string",
        "label": "API Key",
        "description": "Your API key for the external service",
        "secret": true,
        "required": true,
        "validation": {
          "pattern": "^[A-Za-z0-9]{32}$",
          "message": "API key must be 32 alphanumeric characters"
        }
      },
      "mode": {
        "type": "select",
        "label": "Operation Mode",
        "default": "basic",
        "enum": ["basic", "advanced", "debug"]
      }
    }
  },
  "dependencies": {
    "core-utils": "^1.2.0",
    "monitoring-base": ">=2.0.0"
  },
  "data": ["data/default-presets.json"]
}
```

### Manifest Fields Detail

- **dependencies**: A map of plugin IDs and semver version constraints. Required plugins will be auto-enabled or requested.
- **data**: An array of file paths (relative to plugin root) to be automatically loaded into `context.storage` on activation. The storage key is `data/` plus the path without its extension, with a leading `data/` folder collapsed: `data/default-presets.json` is read with `context.storage.get('data/default-presets')`.
- **configuration**: Defines a schema for settings. The UI is automatically generated with validation. Supported types: `string`, `number`, `boolean`, `select`.
- **`secret: true` settings are encrypted at rest.** String properties flagged `secret` (like the `apiKey` above) are stored AES-256-GCM encrypted with a machine-bound key, both in memory snapshots and in `plugin-config.json`. The plugin still reads/writes them transparently via `settings.get`/`set`; the settings UI masks them.

---

## Main Process API (Node.js)

Your `index.js` can export several lifecycle hooks.

```javascript
module.exports = {
  /**
   * Called before the plugin is activated.
   * Useful for pre-loading data or validating state.
   */
  beforeActivate: async (context) => {
    context.logger.info('Preparing plugin...');
  },

  /**
   * Main activation hook. This is where you register UI elements
   * and start your plugin logic.
   */
  activate: async (context) => {
    context.logger.info('Plugin activated!');

    // Access auto-loaded data
    const defaults = await context.storage.get('data/default-presets');

    // Subscribe to app events
    context.events.onClusterConnected((cluster) => {
      context.logger.info(`Connected to ${cluster.name}`);
    });

    // Register UI elements
    context.ui.registerSidebarItem({
      id: 'my-item',
      label: 'Stats',
      route: '/plugin/my-plugin',
    });

    // Pod metrics (requires a metrics server in the cluster)
    const metrics = await context.kubernetes.getPodMetrics('default');

    // Deduped notification: same key fires at most once per cooldown window
    context.ui.notifyOnce(
      'high-restarts',
      'Pod restarts above threshold',
      'warning'
    );

    // Watch resources; returns an unsubscribe function — call it in deactivate
    const stop = context.kubernetes.watchResources('pods', (event) => {
      /* ... */
    });
  },

  /**
   * Called after the plugin is fully activated.
   */
  afterActivate: async (context) => {
    context.ui.showNotification('Plugin is ready!', 'success');
  },

  /**
   * Called before the plugin is deactivated.
   */
  beforeDeactivate: async (context) => {
    context.logger.info('Shutting down...');
  },

  /**
   * Main deactivation hook. Perform cleanup here.
   */
  deactivate: async () => {
    console.log('Plugin deactivated');
  },
};
```

## Testing Your Plugin

### Manual Testing

1.  Run Shoal from source (`npm run dev`).
2.  On the **Plugins** page, click **"Load Unpacked Plugin"** and select your plugin directory.
3.  The app will watch your files and automatically reload the plugin on changes.

### Debugging

Use `context.logger` to output information:

```javascript
context.logger.debug('Useful debug info');
```

View logs in the Developer Console (**Ctrl+Shift+I** or **Cmd+Option+I**).

### Unit Testing

We recommend using Vitest for plugin logic:

```javascript
// __tests__/plugin.test.js
import { describe, it, expect, vi } from 'vitest';
import plugin from '../index.js';

describe('My Plugin', () => {
  it('should register sidebar item on activation', () => {
    const mockContext = {
      ui: { registerSidebarItem: vi.fn(), showNotification: vi.fn() },
      logger: { info: vi.fn() },
    };

    plugin.activate(mockContext);
    expect(mockContext.ui.registerSidebarItem).toHaveBeenCalled();
  });
});
```

## UI Renderer (Frontend Extensions)

Plugins can extend the Shoal UI by providing a **renderer script** — a JavaScript module loaded in the renderer process via the `plugin-file://` custom protocol.

### Setup

Add `"renderer": "renderer.js"` to your `plugin.json`. This file is loaded automatically when the plugin is enabled.

### Available Globals

The following globals are injected into the renderer context:

`renderer.js` runs inside an isolated, opaque-origin iframe with no access to
the host DOM or to the real IPC bridge. The following globals are injected;
all host access goes through `window.k8sPlugin` (see API reference), which
resolves with plain data and throws on failure. A `window.electron` shim that
mirrors the old `{ success, data }` IPC surface still exists for plugins
written before the sandbox, but it is legacy: new code and the bundled
examples use `window.k8sPlugin`.

| Global                    | Description                                                                       |
| ------------------------- | --------------------------------------------------------------------------------- |
| `window.React`            | React 19                                                                          |
| `window.LucideIcons`      | All Lucide icon components                                                        |
| `window.K8sUI`            | Core UI components (`Button`, `Badge`, `Card`, `Spinner`)                         |
| `window.k8sPlugin`        | The permission-gated host API (kubernetes, helm, manifests, settings, ui, events) |
| `window.pluginUIRegistry` | Register the components for your page/widgets/modals/actions (object form)        |

The host mounts exactly one contribution per frame (the page, one widget, or one
modal), so register components by id and let the host pick which to show.

### Registering a Page

```javascript
// renderer.js
const { pluginUIRegistry, React, k8sPlugin } = window;

function MyPage() {
  return React.createElement('div', null, 'Hello from my plugin!');
}

pluginUIRegistry.registerPage({ id: 'my-cool-plugin', component: MyPage });
k8sPlugin.ready();
```

The page is accessible at `/plugin/my-cool-plugin` (the plugin id).

### Registering a Dashboard Widget

Declare the widget in `plugin.json` (`extensions.widgets`), then register the
component with the same id:

```javascript
function MyWidget() {
  return React.createElement('div', { className: 'p-4' }, 'My Widget');
}

pluginUIRegistry.registerWidget({
  id: 'my-widget',
  pluginId: 'my-cool-plugin',
  title: 'My Widget',
  size: 'small',
  component: MyWidget,
});
```

### Modals and Resource Actions

```javascript
// A modal component receives an injected `onClose`.
function ConfirmModal(props) {
  return React.createElement('div', { className: 'p-6' }, [
    React.createElement('p', { key: 't' }, 'Delete ' + props.name + '?'),
    React.createElement(
      window.K8sUI.Button,
      { key: 'c', onClick: () => props.onClose() },
      'Cancel'
    ),
  ]);
}
pluginUIRegistry.registerModal({ id: 'confirm', component: ConfirmModal });

// Open it from anywhere in your UI (requires the "ui" permission):
k8sPlugin.ui.showModal('confirm', { name: 'pod-1' });

// A resource-table action: declare it in plugin.json
// (extensions.resourceActions) and register the component here. It opens in a
// modal frame with the clicked resource passed as props.resource.
pluginUIRegistry.registerResourceAction({
  id: 'inspect',
  component: ConfirmModal,
});
```

---

## Complete API Reference

### Context Object

Passed to `activate(context)`.

#### context.kubernetes

| Method                                 | Description                           | Returns                 |
| -------------------------------------- | ------------------------------------- | ----------------------- |
| `getResources(type, namespace?)`       | Fetch resources                       | `Promise<Resource[]>`   |
| `createResource(manifest)`             | Create resource                       | `Promise<Result>`       |
| `updateResource(type, name, manifest)` | Update resource                       | `Promise<Result>`       |
| `deleteResource(type, name, ns)`       | Delete resource                       | `Promise<Result>`       |
| `executeCommand(pod, cmd)`             | Run cmd in pod                        | `Promise<string>`       |
| `getPodMetrics(namespace)`             | CPU/memory per pod via metrics server | `Promise<PodMetrics[]>` |
| `watchResources(type, cb)`             | Watch resources                       | `UnsubscribeFn`         |

#### context.ui

| Method                                    | Description                                                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `registerSidebarItem(item)`               | Add entry to left navigation                                                                                                 |
| `registerPage(route, comp)`               | Register custom React page at a `/plugin/*` route                                                                            |
| `registerResourceAction(type, act)`       | Add button to resource rows in Cluster Details                                                                               |
| `registerDashboardWidget(widget)`         | Add widget tile to the Dashboard page                                                                                        |
| `showNotification(msg, type)`             | Show Sonner toast (type: `success`, `error`, `info`, `warning`)                                                              |
| `notifyOnce(key, msg, type, cooldownMs?)` | Like `showNotification`, but deduped: the same `key` fires at most once per cooldown window (ledger resets on plugin reload) |

> **Note:** This table is the **main-process** `context` (passed to
> `activate(context)` in `index.js`). All **UI** — pages, widgets, modals, and
> resource actions — is now registered in **`renderer.js`** via
> `window.pluginUIRegistry` and opened via `window.k8sPlugin.ui` (see
> [Renderer UI](#registering-a-page) above). The renderer runs sandboxed; it is
> the correct place for anything that renders.

#### context.events

The `EventsAPI` provides a global event bus for the application.

| Method                           | Description                         |
| -------------------------------- | ----------------------------------- |
| `on(event, handler)`             | Subscribe to a custom event         |
| `once(event, handler)`           | Subscribe to an event once          |
| `off(event, handler)`            | Unsubscribe from an event           |
| `emit(event, ...args)`           | Emit a custom event                 |
| `onClusterConnected(handler)`    | Called when cluster is connected    |
| `onClusterDisconnected(handler)` | Called when cluster is disconnected |
| `onResourceCreated(handler)`     | Called when K8s resource is created |
| `onResourceUpdated(handler)`     | Called when K8s resource is updated |
| `onResourceDeleted(handler)`     | Called when K8s resource is deleted |

#### context.storage

| Method            | Description                                                                       |
| ----------------- | --------------------------------------------------------------------------------- |
| `get(key)`        | Retrieve data                                                                     |
| `set(key, value)` | Save data                                                                         |
| `delete(key)`     | Remove data                                                                       |
| `data/{file}`     | Auto-loaded data files (path without extension, leading `data/` folder collapsed) |

#### context.logger

- `info(msg)`, `warn(msg)`, `error(msg)`, `debug(msg)`

### `window.k8sPlugin` (renderer)

The sandboxed-iframe surface, gated per method by `METHOD_TABLE`
(`src/features/plugins/sandbox/protocol.ts`) against the plugin's declared
permissions:

- `kubernetes.{getResources, getPods, getNamespaces, getLogs, getPodMetrics, describeResource, getResourceYaml, deleteResource, getCurrentContext, getClusters}` — `kubernetes` permission
- `helm.{install, upgrade, rollback, uninstall, repoAdd, repoList}` — `kubernetes` permission
- `manifests.{apply, save}` — `kubernetes` permission
- `settings.{get, set}` — own settings only; the host injects the plugin id
- `ui.{openExternal, showNotification, setHeight, setTitle, showModal, closeModal}` — `ui` permission
- `events.on(name, cb)`, `ready()`

Every call returns a Promise; anything outside the table is rejected.

## Publishing & Security

### Preparing for Release

1. **Validate manifest**: Ensure all required fields in `plugin.json` are present and correct.
2. **Permissions**: Request only the permissions your plugin actually uses.
3. **Test locally**: Use **"Load Unpacked Plugin"** in a development build (`npm run dev`) to verify behavior before packaging.

### Self-Distribution

Package your plugin as a `.zip` archive containing `plugin.json`, `index.js`, and any other files. Users install it via **"Load Unpacked Plugin"** (directory picker) or by placing the unzipped folder in the plugins directory:

- **Windows**: `%APPDATA%\Shoal\plugins\`
- **macOS**: `~/Library/Application Support/Shoal/plugins/`
- **Linux**: `~/.config/Shoal/plugins/`

Packaged builds only load plugins that carry a valid `plugin.json.sig`. The signature covers the whole plugin: the file lists the SHA-256 of every file in the plugin directory (manifest and code) and an RSA-SHA256 signature over that list, made with the Shoal signing key. Any file changed, added or removed after signing makes the plugin fail to load, so sign last. Plugin ids of the plugins bundled with Shoal are reserved and cannot be imported. Unsigned or out-of-date plugins load only in development (`npm run dev`, which sets `ALLOW_UNSIGNED_PLUGINS=true`). In installed builds, **"Load Unpacked Plugin"** checks the signature before copying anything and refuses an unsigned plugin with an explanation. During the 0.9 beta there is no way to get a third-party plugin signed yet; signing through the marketplace arrives with 1.0.

### Paid Plugins & Licensing

Plugins can be sold through the marketplace. Declare the model in the `license` field of `plugin.json`:

```json
{
  "license": {
    "type": "paid",
    "spdx": "proprietary",
    "pricing": {
      "model": "one-time",
      "price": 9.99,
      "currency": "EUR",
      "trialDays": 14
    }
  }
}
```

- **`type`**: `'free' | 'paid' | 'trial' | 'subscription'`.
- **`pricing.model`**: `'one-time' | 'subscription' | 'freemium'` (subscriptions take an `interval` of `'monthly'` or `'yearly'`).

How it works for the user:

1. **Trial**: paid plugins can offer a trial (14-day JWT license, one per machine per plugin) started from the app with one click.
2. **Purchase**: the **Buy** button opens a checkout page in the browser; when payment completes, the app receives the license key automatically, activates it, and installs the plugin.
3. **Activation**: license keys are validated against the marketplace API and stored encrypted on the machine. Users can deactivate a license to move it to another machine.

At runtime the app enforces the license state: an expired trial or missing license keeps the plugin in the `trial`/`expired` state and its UI unavailable until activated.

### Marketplace Submission

Production plugin distribution goes through **kdMarket**, the standalone marketplace API (plugin catalog, licensing, and checkout), planned for 1.0. Submission/developer-portal tooling is still being rolled out — see [PLUGIN_ARCHITECTURE.md](./PLUGIN_ARCHITECTURE.md) for the architecture and `docs/PENDING_WORK.md` for the current release plan.
