# API Reference 📚

This document describes all IPC methods available to the renderer process via the `window.electron` API, as defined in `electron/preload.ts`.

## Cluster Management

### `getClusters()`

Returns a list of all detected Kubernetes clusters.

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

- **Returns**: `Promise<string>`

### `switchContext(contextName)`

Switches the active kubeconfig context.

- **Parameters**: `contextName`: `string`
- **Returns**: `Promise<Result<void>>`

## Kubernetes Resources

### `getResources(args)`

Fetches resources of a specific type from a namespace.

- **Arguments**:
  - `contextName`: `string`
  - `resourceType`: `string` (e.g., 'pods', 'deployments')
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

## Application Settings

### `getAppVersion()`

- **Returns**: `Promise<string>`

### `getKubeconfigPath()`

- **Returns**: `Promise<string>`

### `setKubeconfigPath(path)`

Updates the kubeconfig file path.

- **Parameters**: `path`: `string`
- **Returns**: `Promise<Result<void>>`

## Plugin System

### `getPlugins()`

Lists all installed plugins and their status.

- **Returns**: `Promise<Plugin[]>`

### `enablePlugin(pluginId)` / `disablePlugin(pluginId)`

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

### `activatePluginLicense(pluginId, licenseKey)`

- **Arguments**: `pluginId`, `licenseKey`
- **Returns**: `Promise<Result<void>>`

### `getMarketplacePlugins()`

Fetches the list of plugins available in the marketplace.

- **Returns**: `Promise<MarketplacePlugin[]>`

## Events (Listen)

### `onSetKubeconfigPath(callback)`

Fires when the kubeconfig path is changed.

- **Callback**: `(success: boolean) => void`

### `onPluginNotification(callback)`

Fires when a plugin sends a notification to the UI.

- **Callback**: `(data: any) => void`
