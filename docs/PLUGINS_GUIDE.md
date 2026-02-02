# Kubernetes Desktop Plugin Developer Guide 🚀

This guide explains how to build, test, and distribute plugins for Kubernetes Desktop.

## Overview

Kubernetes Desktop uses a **Hybrid Plugin Architecture**.

- **Main Process**: Handle system-level tasks via Node.js.
- **Renderer Process**: Extend the UI with React components.

## Prerequisites

Before developing plugins, ensure you have:

- **Kubernetes Desktop** installed and running
- **Node.js v18+** installed
- **TypeScript** knowledge (recommended)
- **React** knowledge (for UI extensions)
- Basic understanding of Kubernetes concepts

## Development Setup

1.  **Enable Developer Mode**: Open Kubernetes Desktop Settings and toggle "Developer Mode".
2.  **Create Plugin Directory**:
    - Windows: `%USERPROFILE%\.kubernetes-desktop\plugins\my-plugin\`
    - macOS/Linux: `~/.kubernetes-desktop/plugins/my-plugin/`
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
  "description": "Adds awesome features to K8s Desktop",
  "author": "Your Name",
  "main": "index.js",
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
- **data**: An array of file paths (relative to plugin root) to be automatically loaded into `context.storage` on activation. Accessible via `context.storage.get('data:filepath')`.
- **configuration**: Defines a schema for settings. The UI is automatically generated with validation. Supported types: `string`, `number`, `boolean`, `select`.

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
    const defaults = await context.storage.get(
      'data:data/default-presets.json'
    );

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

1.  Ensure **Developer Mode** is enabled in Settings.
2.  Click **"Load Unpacked Plugin"** and select your plugin directory.
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

## Complete API Reference

### Context Object

Passed to `activate(context)`.

#### context.kubernetes

| Method                                 | Description     | Returns               |
| -------------------------------------- | --------------- | --------------------- |
| `getResources(type, namespace?)`       | Fetch resources | `Promise<Resource[]>` |
| `createResource(manifest)`             | Create resource | `Promise<Result>`     |
| `updateResource(type, name, manifest)` | Update resource | `Promise<Result>`     |
| `deleteResource(type, name, ns)`       | Delete resource | `Promise<Result>`     |
| `executeCommand(pod, cmd)`             | Run cmd in pod  | `Promise<string>`     |
| `watchResources(type, cb)`             | Watch resources | `UnsubscribeFn`       |

#### context.ui

| Method                              | Description            |
| ----------------------------------- | ---------------------- |
| `registerSidebarItem(item)`         | Add to sidebar         |
| `registerPage(route, comp)`         | Add new page           |
| `registerResourceAction(type, act)` | Add button to resource |
| `showNotification(msg, type)`       | Show toast             |
| `openModal(comp, props)`            | Open dialog            |

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

| Method            | Description                            |
| ----------------- | -------------------------------------- |
| `get(key)`        | Retrieve data                          |
| `set(key, value)` | Save data                              |
| `delete(key)`     | Remove data                            |
| `data:{filepath}` | Special key for auto-loaded data files |

#### context.logger

- `info(msg)`, `warn(msg)`, `error(msg)`, `debug(msg)`

## Publishing & Security

### Preparing for Release

1.  **Validate manifest**: Ensure all fields in `plugin.json` are correct.
2.  **Permissions**: Request only what you need.
3.  **Signatures**: Marketplace plugins must be signed using our RSA key.

### Publishing to Marketplace

1.  Pack your plugin: `kd-plugin build ./my-plugin`
2.  Sign: `kd-plugin sign ./my-plugin`
3.  Submit via Developer Portal at `marketplace.kubernetes-desktop.com`.

### Self-Distribution

Distribute as a `.zip`. Users can install via **"Install from File"** in the Plugins page (shows security warning).
