# Plugin System Architecture

A hybrid plugin architecture that extends Shoal through sandboxed third-party extensions. The marketplace and licensing side is implemented but hidden in the 0.9 beta; it ships with 1.0.

> **Note:** This document was originally written as an implementation plan. The core plugin system (Phases 1–3) is now fully implemented. Sections below reflect the current architecture.

---

## Architecture Decisions

### Hybrid Plugin Model

Shoal uses a **hybrid plugin architecture**:

- **Main Process plugins** (`index.js`): Node.js code running in the Electron main process. Executed inside a `vm` context with a built-in allowlist (`electron/services/plugins/plugin-sandbox.ts`: `path`, `util`, `url`, `events`, `stream`, `crypto`) and a permission-gated `PluginContext`. The `vm` context isolates modules and globals, it is not a security boundary (see `SECURITY.md`): trust comes from the plugin signature.
- **Renderer plugins** (`renderer.js`): the plugin's UI, run inside an **isolated sandboxed iframe** (`sandbox="allow-scripts"`, opaque origin). The iframe has **no access** to `window.electron`, the host DOM, cookies, or other plugins. Its entire capability surface is `window.k8sPlugin`, a promise-based, permission-gated API delivered over a `MessageChannel` (see below).

### Monetization Model (planned for 1.0)

The manifest `license` field already models what the marketplace will sell:

- **Free Plugins**: Open-source plugins (MIT, Apache-2.0, LGPL-3, etc.)
- **Paid Plugins**: Commercial plugins with per-installation licensing and activation keys
- **Trial Periods**: Optional time-limited trials for paid plugins
- **License types** (`license.type`): `free`, `paid`, `trial`, `subscription`; pricing models `one-time`, `subscription` (monthly or yearly) and `freemium`

In 0.9 the marketplace is hidden (`MARKETPLACE_ENABLED`), so every plugin that runs is free and signed with the Shoal key.

### Security Model

- Plugin signing via RSA over the SHA-256 of every plugin file (`electron/services/security/signature-service.ts`, `plugin-integrity.ts`)
- Manifest-based permission declarations (`kubernetes`, `ui`, `storage`)
- Renderer UI runs in a sandboxed iframe with a permission-gated bridge (see below)
- Node entry (`index.js`) of user-installed plugins runs in an isolated
  Electron utility process (see "Main-Process Isolation" below)
- License validation and encrypted local storage
- `ALLOW_UNSIGNED_PLUGINS=true` env var required in dev mode to bypass signature checks

### Main-Process Isolation (utility process)

A plugin's Node entry never shares a process with Electron internals unless it
is trusted. `plugin-loader.shouldIsolatePlugin()` decides per plugin:

- **User-installed plugins** (under the userData `plugins/` dir — anything
  installed from the marketplace or imported) run in a dedicated
  `utilityProcess` spawned by
  `electron/services/plugins/host/plugin-host-manager.ts`. The entry file is
  still executed inside the `vm` sandbox (defense in depth) by
  `host/plugin-host.ts`, and the `PluginContext` it receives is a proxy:
  every privileged call is forwarded over the process boundary and executed
  by the real, permission-enforcing context in main. Crashes, hangs, or vm
  escapes are confined to the disposable child process.
- **Bundled plugins** (shipped in-tree) keep the original in-process `vm`
  execution. Packaged builds ship them as electron-builder `extraResources`
  under `resources/plugins/` (outside `app.asar`), they must carry a valid
  `plugin.json.sig` covering all their files, their ids are reserved (the
  bundled directory is searched first and import refuses them), and the ids in
  `BUNDLED_DEFAULT_ENABLED`
  (`electron/constants.ts`) are enabled on first run.
- `PLUGIN_ISOLATION=all` forces isolation for every plugin;
  `PLUGIN_ISOLATION=off` disables it (useful for debugging).

The RPC protocol lives in `host/host-protocol.ts`; callbacks
(`watchResources`, `events.onBroadcast`, app lifecycle events) are bridged by
id, and every subscription is cleaned up when the plugin is disabled or its
host process dies. `events.on/emit` stay local to the plugin, and
`ui.notifyOnce` keeps its cooldown ledger inside the host process (it resets
on reload, matching in-process behaviour).

### Renderer Sandbox

Plugin UI never runs in the host realm. Each plugin page is hosted by
`src/features/plugins/sandbox/PluginFrame.tsx`, which:

1. Creates a `sandbox="allow-scripts"` iframe pointing at the shipped host
   document `public/plugin-host/index.html` (opaque origin — no host access).
2. Establishes a `MessageChannel` and transfers one port into the iframe.
3. Runs a `PluginHostBridge` on its side that **enforces the permission gate**
   before routing any call to `window.electron`.

Inside the iframe, `public/plugin-host/bootstrap.js` adopts the port, exposes
`window.k8sPlugin`, and loads the plugin's `renderer.js` into `#root`.

**Loading assets: the `plugin-file:` protocol.** The frame has an opaque
origin, and Chromium does not let opaque-origin documents load `file:`
resources. So the plugin's `renderer.js` and styles, and in packaged builds
(which load the app from `file:`) also the host document, `bootstrap.js` and
the app stylesheets, are served through the privileged `plugin-file:` scheme:

- URL format `plugin-file://local/<absolute path, percent-encoded segments>`,
  built by `toPluginFileUrl()` / `toFrameSafeUrl()` in
  `electron/shared/plugin-file-url.ts` (Node-free, shared by main and
  renderer).
- `electron/services/plugins/plugin-file-protocol.ts` answers a request only
  when the file, after `realpath`, is inside a plugin discovery directory or
  the app's `dist/` (`pathService.getAppDistDir()`); anything else is a 403.
- The plugin loader rejects a manifest whose `renderer` or `styles` point
  outside the plugin directory.

**Content Security Policy of the frame** (`public/plugin-host/index.html`,
and sent as a header with every `plugin-file:` response by
`plugin-file-protocol.ts`): scripts and styles only from the host document
and `plugin-file:`, images and fonts also from `data:`/`blob:`, and
`connect-src 'none'`. The main process also refuses any navigation of a
plugin frame away from the host document. Plugin renderers cannot reach the
network on their own; everything goes through
`window.k8sPlugin`. (A permission-gated network call in the SDK is planned
for 1.0; the ci-pipeline-view, helm-manager and secret-manager marketplace
plugins still call `fetch` directly and need it.)

The complete method allowlist lives in
`src/features/plugins/sandbox/protocol.ts` (`METHOD_TABLE`). To grant a new
capability, add it there deliberately. Notable rules:

- `kubernetes.*` and `manifests.*` require the `kubernetes` permission.
- `ui.*` requires the `ui` permission.
- `settings.get/set` need no permission but act ONLY on the plugin's own
  settings — the host injects the plugin id, so a plugin can never read or
  write another plugin's data.

#### `window.k8sPlugin` (renderer API)

```js
// kubernetes (needs "kubernetes" permission)
await k8sPlugin.kubernetes.getCurrentContext();
await k8sPlugin.kubernetes.getPods(contextName);
await k8sPlugin.kubernetes.getResources({ contextName, resourceType, namespace });
await k8sPlugin.kubernetes.getLogs({ contextName, podName, namespace, tailLines });
await k8sPlugin.kubernetes.deleteResource({ ... });
// manifests (needs "kubernetes")
await k8sPlugin.manifests.apply(id);
await k8sPlugin.manifests.save(manifest);
// settings (own settings only)
await k8sPlugin.settings.get();
await k8sPlugin.settings.set({ ... });
// ui (needs "ui")
await k8sPlugin.ui.openExternal('https://example.com');
await k8sPlugin.ui.showNotification('Done', 'success');
k8sPlugin.ui.setTitle('My Plugin');   // host page title
k8sPlugin.ui.setHeight(480);          // resize the frame
// lifecycle
k8sPlugin.ready();                     // call once mounted
```

Plugins own their rendering stack (plain DOM, React, etc.) and mount into
`#root`; the host does not provide a framework. The scaffold written by
`generatePlugin` (`template-service.ts`, reachable from the Plugins page in
development builds) emits a working `renderer.js` reference.

---

## Implemented Files

### Core Plugin Infrastructure (`electron/services/plugins/`)

| File                          | Description                                                                                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugin-manager.ts`           | Central orchestrator. Wires together loader, registry, context, and dependency resolver.                                                                                                                                                          |
| `plugin-loader.ts`            | Discovers plugins from disk, validates manifests, requires entry point. Decides in-process vs utility-process execution and hands out module handles.                                                                                             |
| `host/plugin-host.ts`         | Utility-process entry: runs the plugin's `index.js` in a vm sandbox with an RPC-proxied `PluginContext`.                                                                                                                                          |
| `host/plugin-host-manager.ts` | Main-process side: spawns/kills plugin utility processes and routes context RPC to the real permission-enforcing context.                                                                                                                         |
| `host/module-handle.ts`       | `PluginModuleHandle` abstraction — `LocalPluginModule` (in-process vm) and `RemotePluginModule` (utility process) behind one interface.                                                                                                           |
| `host/host-protocol.ts`       | Typed message contract between main and plugin host processes.                                                                                                                                                                                    |
| `plugin-registry.ts`          | Persists plugin state and settings in `plugin-config.json`.                                                                                                                                                                                       |
| `plugin-context.ts`           | Creates the scoped API surface (`kubernetes`, `ui`, `storage`, `logger`, `events`) injected into each plugin.                                                                                                                                     |
| `plugin-events.ts`            | Global event bus used by `context.events`. Supports `on`, `once`, `off`, `emit` and app-level events.                                                                                                                                             |
| `dependency-resolver.ts`      | Topological sort for activation order; detects circular dependencies; cascades disable to dependents.                                                                                                                                             |
| `path-service.ts`             | Platform-aware path resolution for the plugins directory (`<userData>/plugins/`, i.e. `%APPDATA%\Shoal\plugins\` on Windows and `~/.config/Shoal/plugins/` on Linux) and the bundled plugins directory (`resources/plugins/` in packaged builds). |
| `storage-service.ts`          | Key-value storage scoped per plugin, one SQLite table (`plugin_kv` in `plugins_storage.db`) with JSON-serialised values.                                                                                                                          |
| `data-loader.ts`              | Auto-loads files declared in the `data` manifest field into `context.storage`.                                                                                                                                                                    |
| `template-service.ts`         | Scaffolds new plugin directories from a built-in template.                                                                                                                                                                                        |

### Security (`electron/services/security/`)

| File                   | Description                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `license-manager.ts`   | Validates and activates license keys; manages trial periods; encrypts license data locally. |
| `signature-service.ts` | RSA verification of the signed file list (manifest and code) of each plugin.                |
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
4. SignatureService verifies the signature and that every plugin file still matches its signed hash (a failure only warns in dev with ALLOW_UNSIGNED_PLUGINS)
5. DependencyResolver sorts plugins by dependency graph
6. PluginRegistry checks enabled/disabled state from plugin-config.json
7. For enabled plugins: PluginContext created → plugin.beforeActivate() → plugin.activate()
8. UI extensions (sidebar items, pages) registered in extensions registry
9. plugin.afterActivate() called
```

Start-up does not wait for the plugins: the window opens first and the
enabled plugins are then activated one at a time, each with a 5-second budget
(`STARTUP_ACTIVATION_WAIT_MS` in `plugin-manager.ts`). A plugin whose
`activate()` takes longer (a `kubectl` call against an unreachable cluster,
say) keeps activating in the background while the next one starts, and the
renderer follows every state change through the `plugin-state-changed` event
(`onPluginStateChanged` in the API reference), so the plugin list and the
sidebar catch up when it finishes.

Each lifecycle hook of an in-process plugin (the bundled ones) has a
30-second budget (`HOOK_TIMEOUT_MS` in `plugin-manager.ts`). A hook that has
not returned by then fails the activation: it is rolled back (`deactivate()`,
extensions cleared) and the plugin shows as errored with the reason, and
Enable or Reload report it instead of hanging. JavaScript in the main process
cannot be interrupted, so the hook itself keeps running in the background.
Isolated plugins have the host's own limits instead (`LOAD_TIMEOUT_MS` and
`INVOKE_TIMEOUT_MS` in `plugin-host-manager.ts`).

---

## Plugin Extension Points

All UI contributions render inside the plugin's sandboxed iframe — no plugin
code runs in the host realm. Widgets and resource actions are **declared in the
manifest** (`extensions.*`) so the host can render the entry (button/card)
without executing the plugin; the plugin registers the matching component in its
`renderer.js` via `pluginUIRegistry`.

| Point             | Declared / Registered                                                          | Description                                                                    |
| ----------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Sidebar items     | manifest `extensions.sidebar`                                                  | Adds entries to the left navigation (from the manifest; no code run)           |
| Pages             | `pluginUIRegistry.registerPage({ id, component })`                             | The plugin's page, mounted in a `fill` sandbox frame at `/plugin/:id`          |
| Dashboard widgets | manifest `extensions.widgets` + `registerWidget({ id, component })`            | Each widget mounts in its own `content`-sized sandbox frame on the Dashboard   |
| Resource actions  | manifest `extensions.resourceActions` + `registerResourceAction({ id, comp })` | Button per matching resource row; opens the action component in a modal frame  |
| Modals            | `registerModal({ id, component })` + `k8sPlugin.ui.showModal(id, props)`       | Renders in a sandboxed overlay frame; `props` structured-cloned; requires `ui` |
| Notifications     | `k8sPlugin.ui.showNotification(msg, type)`                                     | Shows a Sonner toast (host-side); requires `ui`                                |

---

## Plugin Structure

```
<userData>/plugins/my-plugin/
├── plugin.json        # Manifest (required)
├── index.js           # Entry point (required)
├── assets/
│   └── icon.svg
└── README.md
```

**plugin.json** fields: `id`, `name`, `version`, `description`, `author`, `main`, `permissions`, `license`, `extensions`, `configuration`, `dependencies`, `data`. See [PLUGINS_GUIDE.md](./PLUGINS_GUIDE.md) for full field reference.

---

## Marketplace Backend

The marketplace is hidden in the 0.9 beta (`MARKETPLACE_ENABLED`). Its backend is **kdMarket**, a separate private repository (`/v1` API: catalog, licensing, checkout), planned for 1.0. In development, when no backend answers at `MARKETPLACE_BACKEND_URL`, `marketplace-service.ts` falls back to the sample catalog in `electron/data/marketplace.json`.

---

## Implementation Roadmap

| Phase       | Description                                                                      | Status                      |
| ----------- | -------------------------------------------------------------------------------- | --------------------------- |
| **Phase 1** | Core plugin system: loader, registry, context, UI extensions, management page    | ✅ Complete                 |
| **Phase 2** | Licensing & monetization: license manager, trial periods, plugin signing         | ✅ Complete                 |
| **Phase 3** | Marketplace client: browse catalog, install/update plugins (sample catalog)      | ✅ Complete (hidden in 0.9) |
| **Phase 4** | Production marketplace backend: payments, developer portal, CDN, review workflow | ⏳ Future                   |
| **Phase 5** | Advanced features (see below)                                                    | ⚠️ Partial                  |

### Phase 5 Feature Status

| Feature                                                   | Status                                          |
| --------------------------------------------------------- | ----------------------------------------------- |
| Hot reloading (`reloadPlugin` IPC)                        | ✅ Implemented                                  |
| Dependency resolution (activation order, cascade disable) | ✅ Implemented                                  |
| Plugin scaffolding (`generatePlugin` IPC)                 | ✅ Implemented                                  |
| Import unpacked plugin (`importLocalPlugin` IPC)          | ✅ Implemented                                  |
| `watchResources` API                                      | ✅ (kubectl --watch, returns unsubscribe fn)    |
| Plugin modals (sandboxed)                                 | ✅ Implemented (`ui.showModal` → overlay frame) |
| Resource-table actions (sandboxed)                        | ✅ Implemented (manifest `resourceActions`)     |
| Plugin storage in SQLite (one `plugin_kv` table)          | ✅ Implemented (key-value, JSON values)         |
| Cross-plugin events (`events.broadcast` / `onBroadcast`)  | ✅ Implemented                                  |
| Granular network/filesystem permissions                   | ❌ Future                                       |
| Advanced sandboxing (worker_threads / isolated-vm)        | ❌ Future                                       |
| Remote plugins (npm / URL)                                | ❌ Future                                       |

---

## Known Limitations

**Summary:**

1. **Renderer UI is fully sandboxed**; **bundled main-process code is not a hard boundary**. Plugin `renderer.js` (all UI: pages, widgets, modals, actions) runs in an opaque-origin iframe with only the permission-gated `window.k8sPlugin`. **User-installed** plugins run their `index.js` in an Electron `utilityProcess` with an RPC-proxied context (see "Main-Process Isolation" above). **Bundled** plugins still run in-process in a `vm` sandbox with a built-in allowlist — that limits casual access but is **not** a security boundary against a determined plugin; run only signed/trusted bundled `index.js` (`PLUGIN_ISOLATION=all` forces isolation for everything).
2. **Simple storage**: `StorageAPI` is a key-value table; there are no structured queries, and the `kubernetes` permission is all-or-nothing (reads, writes and Helm; a split is planned for 1.0).
3. **`watchResources` is basic**: it spawns `kubectl get <type> --watch` per subscription (no shared informer, no reconnect on failure) and is available to the Node context only, not the renderer SDK.
4. **No file watcher**: editing a plugin's files does not reload it; use **Reload Plugin** on the Plugins page (`reloadPlugin` IPC).
