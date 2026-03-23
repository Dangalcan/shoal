# API Reference 📚

This document describes all IPC methods available to the renderer process via the `window.electron` API, as defined in `electron/preload.ts`.

All `invoke` methods return a `Promise<Result<T>>`. See the [Types](#types) section for the definition of `Result<T>`.

## Diagnostics

### `runCommand(command)`

Runs an arbitrary shell command (restricted to safe Kubernetes tooling).

- **Parameters**: `command`: `string`
- **Returns**: `Promise<Result<{ stdout: string, stderr: string }>>`

### `checkTool(tool)`

Checks whether a required CLI tool (e.g., `kubectl`, `kind`, `minikube`) is available on the system.

- **Parameters**: `tool`: `string`
- **Returns**: `Promise<Result<boolean>>`

---

## Cluster Management

### `getClusters()`

Returns a list of all detected Kubernetes clusters (kubeconfig contexts).

- **Returns**: `Promise<Result<string[]>>`

### `createCluster(name, provider)`

Creates a new Kubernetes cluster using the specified provider.

- **Parameters**:
  - `name`: `string`
  - `provider`: `string` ('kind', 'minikube', 'k3d')
- **Returns**: `Promise<Result<void>>`

### `deleteCluster(name)`

Deletes the specified cluster.

- **Parameters**: `name`: `string`
- **Returns**: `Promise<Result<void>>`

### `getCurrentContext()`

Returns the name of the current kubeconfig context.

- **Returns**: `Promise<Result<string>>`

### `switchContext(contextName)`

Switches the active kubeconfig context.

- **Parameters**: `contextName`: `string`
- **Returns**: `Promise<Result<boolean>>`

---

## Kubernetes Resources

### `getNamespaces(contextName)`

Fetches all namespaces for the given context.

- **Parameters**: `contextName`: `string`
- **Returns**: `Promise<Result<string[]>>`

### `getPods(contextName)`

Fetches all pods across all namespaces for the given context.

- **Parameters**: `contextName`: `string`
- **Returns**: `Promise<Result<any[]>>`

### `getResources(args)`

Fetches resources of a specific type from a namespace.

- **Arguments**:
  - `contextName`: `string`
  - `resourceType`: `string` (e.g., 'pods', 'deployments', 'services', 'configmaps')
  - `namespace`: `string` (use 'all' for all namespaces)
- **Returns**: `Promise<Result<any[]>>`

### `getLogs(args)`

Retrieves logs for a specific pod.

- **Arguments**:
  - `contextName`: `string`
  - `podName`: `string`
  - `namespace`: `string`
  - `tailLines`: `number` (optional, default: 200)
- **Returns**: `Promise<Result<string>>`

### `describeResource(args)`

Returns the `kubectl describe` output for a resource.

- **Arguments**: `contextName`, `resourceType`, `resourceName`, `namespace`
- **Returns**: `Promise<Result<string>>`

### `getResourceYaml(args)`

Gets the YAML representation of a resource.

- **Arguments**: `contextName`, `resourceType`, `resourceName`, `namespace`
- **Returns**: `Promise<Result<string>>`

### `rolloutRestart(args)`

Triggers a rollout restart for a deployment or daemonset.

- **Arguments**: Same as `getResourceYaml`
- **Returns**: `Promise<Result<void>>`

### `deleteResource(args)`

Deletes a specific resource.

- **Arguments**: Same as `getResourceYaml`
- **Returns**: `Promise<Result<void>>`

---

## Application Settings

### `getAppVersion()`

- **Returns**: `Promise<Result<string>>`

### `getKubeconfigPath()`

- **Returns**: `Promise<Result<string>>`

### `setKubeconfigPath(path)`

Updates the kubeconfig file path.

- **Parameters**: `path`: `string`
- **Returns**: `Promise<Result<boolean>>`

---

## Manifests

Manifests are YAML/JSON Kubernetes resource definitions stored locally in SQLite. They can be applied to the current cluster context directly from the UI.

### `getManifests(clusterContext?)`

Returns all saved manifests, optionally filtered by cluster context.

- **Parameters**: `clusterContext`: `string` (optional)
- **Returns**: `Promise<Result<Manifest[]>>`

### `saveManifest(manifest)`

Creates or updates a manifest entry. Pass `id` to update an existing manifest.

- **Parameters**: `manifest`: `Partial<Manifest>`
- **Returns**: `Promise<Result<number>>` (Returns the ID of the saved manifest)

### `deleteManifest(id)`

Deletes a saved manifest by ID.

- **Parameters**: `id`: `number`
- **Returns**: `Promise<Result<boolean>>`

### `applyManifest(id)`

Applies a saved manifest to the currently active cluster context using `kubectl apply`.

- **Parameters**: `id`: `number`
- **Returns**: `Promise<Result<void>>`

---

## Plugin System

### `getPlugins()`

Lists all installed plugins and their status.

- **Returns**: `Promise<Result<Plugin[]>>`

### `enablePlugin(pluginId)` / `disablePlugin(pluginId)`

- **Parameters**: `pluginId`: `string`
- **Returns**: `Promise<Result<void>>`

### `reloadPlugin(pluginId)`

Reloads a plugin without restarting the application. Useful during plugin development.

- **Parameters**: `pluginId`: `string`
- **Returns**: `Promise<Result<boolean>>`

### `uninstallPlugin(pluginId)`

Removes a plugin from the plugins directory.

- **Parameters**: `pluginId`: `string`
- **Returns**: `Promise<Result<boolean>>`

### `getPluginExtensions(extensionPoint?)`

Returns UI extensions contributed by plugins.

- **Parameters**: `extensionPoint`: `string` (optional, e.g., 'sidebar')
- **Returns**: `Promise<Result<Extension[]>>`

### `executePluginAction(pluginId, actionId, args?)`

Executes a backend action defined by a plugin.

- **Arguments**:
  - `pluginId`: `string`
  - `actionId`: `string`
  - `args`: `any` (optional)
- **Returns**: `Promise<Result<any>>`

### `getPluginSettings(pluginId)`

Returns the current settings for a plugin, as defined by its configuration schema.

- **Parameters**: `pluginId`: `string`
- **Returns**: `Promise<Result<Record<string, any>>>`

### `setPluginSettings(pluginId, settings)`

Persists plugin settings.

- **Parameters**:
  - `pluginId`: `string`
  - `settings`: `Record<string, any>`
- **Returns**: `Promise<Result<boolean>>`

### `generatePlugin(options)`

Scaffolds a new plugin from a template in the plugins directory.

- **Parameters**: `options`: `PluginScaffoldOptions`
- **Returns**: `Promise<Result<boolean>>`

### `importLocalPlugin()`

Opens a directory picker dialog to load an unpacked plugin from any local path.

- **Returns**: `Promise<Result<void>>`

### `checkForPluginUpdates()`

Checks the marketplace for available updates for installed plugins.

- **Returns**: `Promise<Result<boolean>>`

---

## Plugin Licensing

### `activatePluginLicense(pluginId, licenseKey)`

- **Arguments**: `pluginId`, `licenseKey`
- **Returns**: `Promise<Result<void>>`

### `deactivatePluginLicense(pluginId)`

Deactivates the license for a plugin on this machine.

- **Parameters**: `pluginId`: `string`
- **Returns**: `Promise<Result<void>>`

### `startPluginTrial(pluginId)`

Starts a trial period for a paid plugin.

- **Parameters**: `pluginId`: `string`
- **Returns**: `Promise<Result<void>>`

---

## Marketplace

### `getMarketplacePlugins()`

Fetches the list of plugins available in the marketplace.

- **Returns**: `Promise<Result<MarketplacePlugin[]>>`

### `installPlugin(pluginId)`

Downloads and installs a plugin from the marketplace.

- **Parameters**: `pluginId`: `string`
- **Returns**: `Promise<Result<void>>`

---

## Terminal API

The Terminal API allows creating and interacting with shell sessions (local or pod-exec).

### `terminalCreate(args)`

Creates a new terminal session.

- **Arguments**:
  - `kind`: `'local' | 'pod-exec'`
  - `podName`: `string` (required for `pod-exec`)
  - `namespace`: `string` (required for `pod-exec`)
  - `contextName`: `string` (required for `pod-exec`)
  - `shell`: `string` (optional, default: `/bin/sh` or `powershell.exe`)
  - `cols`: `number` (optional)
  - `rows`: `number` (optional)
- **Returns**: `Promise<Result<{ sessionId: string }>>`

### `terminalInput(sessionId, data)`

Sends input data to a terminal session.

- **Parameters**:
  - `sessionId`: `string`
  - `data`: `string`
- **Returns**: `Promise<Result<boolean>>`

### `terminalResize(sessionId, cols, rows)`

Resizes a terminal session (Note: currently no-op for piped processes).

- **Parameters**: `sessionId`, `cols`, `rows`
- **Returns**: `Promise<Result<boolean>>`

### `terminalKill(sessionId)`

Kills a terminal session.

- **Parameters**: `sessionId`: `string`
- **Returns**: `Promise<Result<boolean>>`

### `terminalInterrupt(sessionId)`

Sends an interrupt signal to the process (Ctrl+C).

- **Parameters**: `sessionId`: `string`
- **Returns**: `Promise<Result<boolean>>`

---

## Events (Listen)

All event listeners return an **unsubscribe function** `() => void`.

### `onSetKubeconfigPath(callback)`

- **Callback**: `(success: boolean) => void`

### `onPluginNotification(callback)`

- **Callback**: `(data: PluginNotificationData) => void`

### `onPluginModal(callback)`

- **Callback**: `(data: PluginModalData) => void`

### `onTerminalOutput(callback)`

Fires when a terminal session produces output.

- **Callback**: `(sessionId: string, data: string) => void`

### `onTerminalExited(callback)`

Fires when a terminal session exits.

- **Callback**: `(sessionId: string) => void`

---

## Types

### `Result<T>`

```typescript
interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### `Plugin`

```typescript
interface Plugin {
  manifest: PluginManifest;
  state: 'disabled' | 'enabled' | 'loading' | 'error' | 'trial' | 'expired';
  error?: string;
  installedAt: string;
  hasUpdate?: boolean;
}
```

### `Manifest`

```typescript
interface Manifest {
  id?: number;
  name: string;
  content: string;
  clusterContext?: string;
}
```
