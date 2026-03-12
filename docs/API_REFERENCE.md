# API Reference 📚

This document describes all IPC methods available to the renderer process via the `window.electron` API, as defined in `electron/preload.ts`.

## Diagnostics

### `runCommand(command)`

Runs an arbitrary shell command (restricted to safe Kubernetes tooling).

- **Parameters**: `command`: `string`
- **Returns**: `Promise<Result<string>>`

### `checkTool(tool)`

Checks whether a required CLI tool (e.g., `kubectl`, `kind`, `minikube`) is available on the system.

- **Parameters**: `tool`: `string`
- **Returns**: `Promise<boolean>`

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
- **Returns**: `Promise<Result<void>>`

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
  - `namespace`: `string`
- **Returns**: `Promise<Result<any[]>>`

### `getLogs(args)`

Retrieves logs for a specific pod.

- **Arguments**:
  - `contextName`: `string`
  - `podName`: `string`
  - `namespace`: `string`
  - `tailLines`: `number` (optional)
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

- **Returns**: `Promise<string>`

### `getKubeconfigPath()`

- **Returns**: `Promise<string>`

### `setKubeconfigPath(path)`

Updates the kubeconfig file path.

- **Parameters**: `path`: `string`
- **Returns**: `Promise<Result<void>>`

---

## Manifests

Manifests are YAML/JSON Kubernetes resource definitions stored locally in SQLite. They can be applied to the current cluster context directly from the UI.

### `getManifests(clusterContext?)`

Returns all saved manifests, optionally filtered by cluster context.

- **Parameters**: `clusterContext`: `string` (optional)
- **Returns**: `Promise<Result<Manifest[]>>`

### `saveManifest(manifest)`

Creates or updates a manifest entry. Pass `id` to update an existing manifest.

- **Parameters**: `manifest`: `{ id?: number, name: string, content: string }`
- **Returns**: `Promise<Result<void>>`

### `deleteManifest(id)`

Deletes a saved manifest by ID.

- **Parameters**: `id`: `number`
- **Returns**: `Promise<Result<void>>`

### `applyManifest(id)`

Applies a saved manifest to the currently active cluster context using `kubectl apply`.

- **Parameters**: `id`: `number`
- **Returns**: `Promise<Result<void>>`

---

## Plugin System

### `getPlugins()`

Lists all installed plugins and their status.

- **Returns**: `Promise<Plugin[]>`

### `enablePlugin(pluginId)` / `disablePlugin(pluginId)`

- **Parameters**: `pluginId`: `string`
- **Returns**: `Promise<Result<void>>`

### `reloadPlugin(pluginId)`

Reloads a plugin without restarting the application. Useful during plugin development.

- **Parameters**: `pluginId`: `string`
- **Returns**: `Promise<Result<void>>`

### `uninstallPlugin(pluginId)`

Removes a plugin from the plugins directory.

- **Parameters**: `pluginId`: `string`
- **Returns**: `Promise<Result<void>>`

### `getPluginExtensions(extensionPoint?)`

Returns UI extensions contributed by plugins.

- **Parameters**: `extensionPoint`: `string` (optional, e.g., 'sidebar')
- **Returns**: `Promise<Extension[]>`

### `executePluginAction(pluginId, actionId, args?)`

Executes a backend action defined by a plugin.

- **Arguments**:
  - `pluginId`: `string`
  - `actionId`: `string`
  - `args`: `any` (optional)
- **Returns**: `Promise<any>`

### `getPluginSettings(pluginId)`

Returns the current settings for a plugin, as defined by its configuration schema.

- **Parameters**: `pluginId`: `string`
- **Returns**: `Promise<Record<string, any>>`

### `setPluginSettings(pluginId, settings)`

Persists plugin settings.

- **Parameters**:
  - `pluginId`: `string`
  - `settings`: `Record<string, any>`
- **Returns**: `Promise<Result<void>>`

### `generatePlugin(options)`

Scaffolds a new plugin from a template in the plugins directory.

- **Parameters**: `options`: `any` (template options)
- **Returns**: `Promise<Result<void>>`

### `importLocalPlugin()`

Opens a directory picker dialog to load an unpacked plugin from any local path.

- **Returns**: `Promise<Result<void>>`

### `checkForPluginUpdates()`

Checks the marketplace for available updates for installed plugins.

- **Returns**: `Promise<Result<PluginUpdate[]>>`

### `installPlugin(pluginId)`

Downloads and installs a plugin from the marketplace.

- **Parameters**: `pluginId`: `string`
- **Returns**: `Promise<Result<void>>`

---

## Plugin Licensing

### `activatePluginLicense(pluginId, licenseKey)`

- **Arguments**: `pluginId`, `licenseKey`
- **Returns**: `Promise<Result<void>>`

### `deactivatePluginLicense(pluginId)`

Deactivates the license for a plugin on this machine (e.g., before transferring to another device).

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

- **Returns**: `Promise<MarketplacePlugin[]>`

---

## Events (Listen)

All event listeners return an **unsubscribe function** `() => void`. Call it to clean up when the component unmounts.

### `onSetKubeconfigPath(callback)`

Fires when the kubeconfig path is changed.

- **Callback**: `(success: boolean) => void`

### `onPluginNotification(callback)`

Fires when a plugin sends a toast notification to the UI.

- **Callback**: `(data: any) => void`

### `onPluginModal(callback)`

Fires when a plugin requests a modal to be opened in the renderer.

- **Callback**: `(data: any) => void`
