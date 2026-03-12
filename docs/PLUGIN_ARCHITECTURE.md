# Plugin System Architecture

A hybrid plugin architecture with marketplace and licensing support that extends Kubernetes Desktop functionality through free and paid third-party extensions.

> **Note:** This document was originally written as an implementation plan. The core plugin system (Phases 1–3) is now fully implemented. Sections below reflect the current architecture.

---

## Architecture Decisions

### Hybrid Plugin Model

Kubernetes Desktop uses a **hybrid plugin architecture**:

- **Main Process plugins** (`index.js`): Node.js code running in the Electron main process. Full access to Node.js APIs, the filesystem, and the application's internal services.
- **UI extensions**: Plugins register sidebar items and custom pages through the `PluginContext` API. The renderer dynamically loads plugin UI via the `plugin-file://` custom protocol.

This model maximizes developer flexibility at the cost of strict sandboxing. Plugin authors are expected to be trusted; see `plugin_system_analysis.md` for the security trade-off discussion.

### Monetization Model

Inspired by Odoo's App Store:

- **Free Plugins**: Open-source plugins (MIT, Apache-2.0, LGPL-3, etc.)
- **Paid Plugins**: Commercial plugins with per-installation licensing and activation keys
- **Trial Periods**: Optional time-limited trials for paid plugins
- **License Types**: One-time purchase, subscription (monthly/yearly), freemium, enterprise

### Security Model

- Plugin signing via RSA (`electron/services/security/signature-service.ts`)
- Manifest-based permission declarations
- License validation and encrypted local storage
- `ALLOW_UNSIGNED_PLUGINS=true` env var required in dev mode to bypass signature checks

---

## Implemented Files

### Core Plugin Infrastructure (`electron/services/plugins/`)

| File                     | Description                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugin-manager.ts`      | Central orchestrator. Wires together loader, registry, context, and dependency resolver.                                                                             |
| `plugin-loader.ts`       | Discovers plugins from disk, validates manifests, requires entry point.                                                                                              |
| `plugin-registry.ts`     | Persists plugin state and settings in `plugin-config.json`.                                                                                                          |
| `plugin-context.ts`      | Creates the scoped API surface (`kubernetes`, `ui`, `storage`, `logger`, `events`) injected into each plugin.                                                        |
| `plugin-events.ts`       | Global event bus used by `context.events`. Supports `on`, `once`, `off`, `emit` and app-level events.                                                                |
| `dependency-resolver.ts` | Topological sort for activation order; detects circular dependencies; cascades disable to dependents.                                                                |
| `path-service.ts`        | Platform-aware path resolution for the plugins directory (`~/.kubernetes-desktop/plugins/` on macOS/Linux, `%USERPROFILE%\.kubernetes-desktop\plugins\` on Windows). |
| `storage-service.ts`     | File-per-key JSON storage scoped per plugin.                                                                                                                         |
| `data-loader.ts`         | Auto-loads files declared in the `data` manifest field into `context.storage`.                                                                                       |
| `template-service.ts`    | Scaffolds new plugin directories from a built-in template.                                                                                                           |

### Security (`electron/services/security/`)

| File                   | Description                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `license-manager.ts`   | Validates and activates license keys; manages trial periods; encrypts license data locally. |
| `signature-service.ts` | RSA plugin signing and verification.                                                        |
| `encryption-utils.ts`  | AES encryption helpers used by the license manager.                                         |

### Marketplace Client (`electron/services/marketplace/`)

| File                     | Description                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `marketplace-service.ts` | HTTP client that fetches the plugin catalog from the marketplace backend and handles plugin installation (download + unzip). |

### TypeScript Types (`electron/types/`)

| File              | Description                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `plugin-types.ts` | `PluginManifest`, `Plugin`, `PluginContext`, `PluginExtensionPoint`, `PluginPermission`, `PluginLicense`, `PluginLicenseInfo`, `PluginMarketplaceInfo` |

### Frontend (`src/features/plugins/`, `src/pages/`)

| File                                      | Description                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/features/plugins/PluginProvider.tsx` | React context provider; fetches plugins from main process and exposes hooks.                      |
| `src/pages/Plugins.tsx`                   | Plugin management page (installed plugins, enable/disable, license activation, trial, uninstall). |
| `src/pages/PluginPage.tsx`                | Dynamic route that renders a plugin's custom UI via the `plugin-file://` protocol.                |

### IPC Bridge (`electron/preload.ts`)

All plugin-related IPC methods are exposed on `window.electron`. See [API_REFERENCE.md](./API_REFERENCE.md) for the full list.

---

## Plugin Discovery & Loading Pipeline

```
1. PathService resolves plugin directories
2. PluginLoader scans directories for plugin.json manifests
3. Manifests validated against schema (id, name, version, main, permissions)
4. SignatureService verifies plugin signature (skipped in dev with ALLOW_UNSIGNED_PLUGINS)
5. DependencyResolver sorts plugins by dependency graph
6. PluginRegistry checks enabled/disabled state from plugin-config.json
7. For enabled plugins: PluginContext created → plugin.beforeActivate() → plugin.activate()
8. UI extensions (sidebar items, pages) registered in extensions registry
9. plugin.afterActivate() called
```

---

## Plugin Extension Points

| Point            | Registration Method                               | Description                                                                          |
| ---------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Sidebar items    | `context.ui.registerSidebarItem(item)`            | Adds entries to the left navigation                                                  |
| Pages            | `context.ui.registerPage(route, component)`       | Registers a custom React page at a `/plugin/*` route                                 |
| Resource actions | `context.ui.registerResourceAction(type, action)` | Adds buttons to resource rows                                                        |
| Notifications    | `context.ui.showNotification(msg, type)`          | Shows Sonner toast notifications                                                     |
| Modal (partial)  | `context.ui.openModal(comp, props)`               | IPC bridge exists (`onPluginModal` event); renderer-side rendering is a pending TODO |

---

## Plugin Structure

```
~/.kubernetes-desktop/plugins/my-plugin/
├── plugin.json        # Manifest (required)
├── index.js           # Entry point (required)
├── assets/
│   └── icon.svg
└── README.md
```

**plugin.json** fields: `id`, `name`, `version`, `description`, `author`, `main`, `permissions`, `license`, `extensions`, `configuration`, `dependencies`, `data`. See [PLUGINS_GUIDE.md](./PLUGINS_GUIDE.md) for full field reference.

---

## Marketplace Backend

The `marketplace-backend/` directory contains a **mock Express.js server** used for local development and testing. It serves a static plugin catalog from `marketplace-backend/public/catalog.json` and provides license activation endpoints backed by SQLite (`license-db-sqlite.ts`).

This is **not** a production marketplace. A full marketplace backend (payment processing, developer portal, CDN, review workflow) is a future project.

---

## Implementation Roadmap

| Phase       | Description                                                                      | Status                     |
| ----------- | -------------------------------------------------------------------------------- | -------------------------- |
| **Phase 1** | Core plugin system: loader, registry, context, UI extensions, management page    | ✅ Complete                |
| **Phase 2** | Licensing & monetization: license manager, trial periods, plugin signing         | ✅ Complete                |
| **Phase 3** | Marketplace client: browse catalog, install/update plugins, mock backend         | ✅ Complete (mock backend) |
| **Phase 4** | Production marketplace backend: payments, developer portal, CDN, review workflow | ⏳ Future                  |
| **Phase 5** | Advanced features (see below)                                                    | ⚠️ Partial                 |

### Phase 5 Feature Status

| Feature                                                   | Status                                             |
| --------------------------------------------------------- | -------------------------------------------------- |
| Hot reloading (`reloadPlugin` IPC)                        | ✅ Implemented                                     |
| Dependency resolution (activation order, cascade disable) | ✅ Implemented                                     |
| Plugin scaffolding (`generatePlugin` IPC)                 | ✅ Implemented                                     |
| Import unpacked plugin (`importLocalPlugin` IPC)          | ✅ Implemented                                     |
| `watchResources` API                                      | ❌ Not yet implemented (TODO in plugin-context.ts) |
| Modal IPC bridge (full renderer support)                  | ⚠️ IPC event exists, renderer handling is TODO     |
| Structured plugin storage (SQLite per plugin)             | ❌ Future (currently file-per-key JSON)            |
| Cross-plugin event communication                          | ❌ Future                                          |
| Granular network/filesystem permissions                   | ❌ Future                                          |
| Advanced sandboxing (worker_threads / isolated-vm)        | ❌ Future                                          |
| Remote plugins (npm / URL)                                | ❌ Future                                          |

---

## Known Limitations

See [plugin_system_analysis.md](./plugin_system_analysis.md) for a detailed analysis of current limitations and proposed improvements.

**Summary:**

1. **No sandboxing**: Plugins run in the Electron main process with full Node.js access. Only install trusted plugins.
2. **Simple storage**: `StorageAPI` uses one JSON file per key. No concurrent write protection or structured queries.
3. **Modal IPC incomplete**: `openModal` sends the IPC event but the renderer does not yet have a generic modal handler for plugin-defined components.
4. **`watchResources` not implemented**: Real-time resource watching via the plugin context API is not yet connected.
