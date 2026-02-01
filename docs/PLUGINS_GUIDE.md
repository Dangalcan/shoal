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
        "secret": true
      }
    }
  }
}
```

## Main Process API (Node.js)

Your `index.js` must export an `activate` function.

```javascript
module.exports = {
  activate: (context) => {
    context.logger.info('Plugin activated!');

    // Register UI elements
    context.ui.registerSidebarItem({
      id: 'my-item',
      label: 'Stats',
      route: '/plugin/my-plugin',
    });

    // Show a notification
    context.ui.showNotification('Plugin is ready!', 'success');
  },

  deactivate: () => {
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

#### context.storage

| Method            | Description   |
| ----------------- | ------------- |
| `get(key)`        | Retrieve data |
| `set(key, value)` | Save data     |
| `delete(key)`     | Remove data   |

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
