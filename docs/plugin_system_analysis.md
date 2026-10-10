# Plugin System Analysis: Shoal

> [!WARNING]
> **Historical document (March 2026).** Written before the sandboxed-iframe plugin UI rework (July 2026). See [PLUGIN_ARCHITECTURE.md](./PLUGIN_ARCHITECTURE.md) for the current architecture.

This document outlines the current state of the plugin system, identifies critical architectural problems, and proposes improvements to enhance security, stability, and developer experience.

## 1. Architectural Overview

The plugin system is composed of several key services:

- **PluginManager**: The central orchestrator for lifecycle and discovery.
- **PluginLoader**: Handles file discovery, manifest validation, and code entry.
- **PluginRegistry**: Manages persistence of plugin states and settings in `plugin-config.json`.
- **DependencyResolver**: Ensures correct activation order and prevents circular dependencies.
- **PluginContext**: Provides a scoped API (`Kubernetes`, `UI`, `Storage`, `Logger`, `Events`) to each plugin.

## 2. Identified Problems & Risks

### 2.1. Execution Isolation vs. Permissiveness

> [!NOTE]
> While strict sandboxing was considered, a **permissive model** using Node.js `require()` was explicitly chosen to allow plugin developers full access to application core logic and Node.js primitives.

**Impact**:

- **Flexibility**: Developers can directly interact with internal services without complex proxied APIs.
- **Responsibility**: Plugin authors must be trusted, as they have full access to the host system.
- **Stability**: Improperly written plugins can still affect the main process; high-quality peer review of plugins is recommended.

### 2.2. Incomplete API Implementation

Several features in `PluginContext` are still pending:

- `watchResources`: Essential for creating reactive plugins (e.g., real-time monitoring). Still marked TODO in `plugin-context.ts`.
- `openModal`: The IPC event (`plugin-modal`) is now emitted from the main process and an `onPluginModal` listener is exposed in `preload.ts`. However, the renderer does not yet have a generic handler to mount arbitrary plugin-defined React components from these events. Full round-trip support is a pending TODO.
- Plugin UI extensions (sidebar items, pages) are registered in an in-memory registry per session. They are re-registered on each plugin activation (at startup or on enable), so persistence across restarts works correctly as long as the plugin remains enabled.

### 2.3. Platform Specificity & Pathing

- Hardcoded pathing logic for Windows and Unix is scattered across `main.ts` and `PluginLoader`.
- Plugin discovery relies on hardcoded indices for `pluginDirectories`.

### 2.4. Storage Limitations

- `StorageAPI` is a simple file-per-key JSON store.
- No support for concurrent writing or structured querying (e.g., finding all items in a sub-namespace).

## 3. Proposed Pipeline for Improvements

### Phase 1: Security & Isolation (High Priority)

1.  **Introduce Workers/VMs**: Move plugin execution to `worker_threads` or use a sandboxing library like `isolated-vm` to restrict global access.
2.  **Proxied APIs**: Ensure that the `PluginContext` injected into the sandbox is the ONLY way for the plugin to interact with the system.

### Phase 2: Completion of Runtime Features

1.  **Implement `watchResources`**: Connect the plugin context to the existing Kubernetes event architecture.
2.  **Standardize UI Interop**: Implement a robust IPC bridge for `openModal` and custom plugin pages.
3.  **Structured Storage**: Replace the file-based `StorageAPI` with a lightweight embedded database (e.g., `Nedb` or `SQLite`) scoped per plugin.

### Phase 3: Developer Experience

1.  **Plugin Events**: Broaden the `EventEmitter` scope to allow cross-plugin communication.
2.  **Granular Permissions**: Implement more fine-grained control over network (e.g., whitelist domains) and filesystem access.

## 4. Conclusion

While the plugin system has a solid foundation (discovery, manifest validation, dependency resolution), the **lack of isolation** is a critical technical debt that must be addressed before the system is opened to third-party developers.
