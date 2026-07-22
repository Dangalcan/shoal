# API Reference 📚

This document describes all IPC methods available to the renderer process via the `window.electron` API, as defined in `electron/preload.ts`.

All `invoke` methods return a `Promise<Result<T>>`. See the [Types](#types) section for the definition of `Result<T>`.

## Diagnostics

### `checkTool(tool)`

Checks whether a required CLI tool (e.g., `kubectl`, `kind`, `minikube`) is available on the system.

- **Parameters**: `tool`: `string`
- **Returns**: `Promise<Result<boolean>>`

### `openExternal(url)`

Opens a URL in the system's default browser (used e.g. to open the
marketplace checkout page).

- **Parameters**: `url`: `string`
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
  - `container`: `string` (optional — a specific container in the pod)
  - `timestamps`: `boolean` (optional — prefix each line with its timestamp)
  - `sinceSeconds`: `number` (optional — only logs newer than this)
- **Returns**: `Promise<Result<string>>`

### `getPodMetrics(args)`

Returns CPU and memory usage for the pods in a namespace via the cluster's
metrics server (`kubectl top pods`). Fails with a descriptive error when the
metrics server is not installed.

- **Arguments**:
  - `contextName`: `string`
  - `namespace`: `string` (use 'all' for all namespaces)
- **Returns**: `Promise<Result<Array<{ namespace: string; name: string; cpuMillicores: number; memoryMi: number }>>>`

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

### `scaleResource(args)`

Scales a workload to a given replica count via `kubectl scale`. Only
`deployments`, `statefulsets` and `replicasets` are accepted; the replica
count must be an integer between 0 and 1000.

- **Arguments**: `contextName`, `resourceType`, `resourceName`, `namespace`, `replicas`
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

### Manifest Folders

Manifests can be organized into nested folders (a Drive-like hierarchy). A manifest's `folder_id` is `null` when it lives at the root. Folder names are limited to 100 characters.

### `getManifestFolders()`

Returns all manifest folders, sorted by name.

- **Returns**: `Promise<Result<ManifestFolder[]>>`

### `saveManifestFolder(folder)`

Creates or renames a folder. Pass `id` to rename an existing folder; pass `parent_id` to create a folder nested inside another one (`null` or omitted for the root).

- **Parameters**: `folder`: `Partial<ManifestFolder>` (`name` required)
- **Returns**: `Promise<Result<number>>` (Returns the ID of the saved folder)

### `deleteManifestFolder(id, mode?)`

Deletes a folder. With mode `move-to-parent` (default), the folder's manifests and subfolders move up to its parent. With mode `recursive`, the folder, all of its subfolders, and every manifest inside are permanently deleted.

- **Parameters**: `id`: `number`, `mode`: `'move-to-parent' | 'recursive'` (optional)
- **Returns**: `Promise<Result<boolean>>`

### `moveManifest(id, folderId)`

Moves a manifest into a folder, or to the root when `folderId` is `null`.

- **Parameters**: `id`: `number`, `folderId`: `number | null`
- **Returns**: `Promise<Result<boolean>>`

### `moveManifestFolder(id, parentId)`

Moves a folder under a new parent, or to the root when `parentId` is `null`. Moving a folder into itself or one of its own descendants is rejected.

- **Parameters**: `id`: `number`, `parentId`: `number | null`
- **Returns**: `Promise<Result<boolean>>`

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

### `createCheckout(pluginId)`

Starts a purchase for a paid plugin. Returns a checkout URL the user opens
in the browser to pay (see `openExternal`), plus a `sessionId` to poll with
`getCheckoutStatus`.

- **Parameters**: `pluginId`: `string`
- **Returns**: `Promise<Result<{ sessionId: string; url: string }>>`

### `getCheckoutStatus(sessionId)`

Polls a checkout session. Once `status` is `'paid'`, `licenseKey` holds the
purchased key to activate and install the plugin with.

- **Parameters**: `sessionId`: `string`
- **Returns**: `Promise<Result<{ status: 'pending' | 'paid'; licenseKey?: string }>>`

---

## App Updates

In-app auto-update via `electron-updater` and GitHub Releases. Update
progress is pushed from the main process on the `update-status` channel
(see `onUpdateStatus`).

### `checkForAppUpdates()`

Triggers a manual update check. Forced even in development so the button
always gives feedback.

- **Returns**: `Promise<Result<boolean>>`

### `installAppUpdate()`

Quits the app and installs a previously downloaded update.

- **Returns**: `Promise<Result<boolean>>`

---

## Terminal API

The Terminal API allows creating and interacting with shell sessions (local or pod-exec).

### `terminalCreate(args)`

Creates a new terminal session. Local sessions start in a dedicated temp
directory (`<os-tmpdir>/kubernetes-desktop-terminal`) rather than the app
installation directory.

- **Arguments**:
  - `kind`: `'local' | 'pod-exec'`
  - `podName`: `string` (required for `pod-exec`)
  - `namespace`: `string` (required for `pod-exec`)
  - `contextName`: `string` (required for `pod-exec`)
  - `shell`: `string` (optional). For `local`, a shell id from
    `terminalShells()` (e.g. `powershell`, `cmd`, `gitbash`, `wsl`) —
    validated against the detected allowlist. For `pod-exec`, the shell
    path inside the container (default: `/bin/sh`).
  - `cols`: `number` (optional)
  - `rows`: `number` (optional)
- **Returns**: `Promise<Result<{ sessionId: string }>>`

### `terminalShells()`

Lists local shells detected on this machine for the shell type picker.

- **Returns**: `Promise<Result<{ shells: LocalShellInfo[]; defaultShell: string }>>`
  - `LocalShellInfo`: `{ id: string; label: string; family: 'windows' | 'unix' }`
  - Windows candidates: PowerShell, PowerShell 7, Command Prompt, Git Bash, WSL
  - Other platforms: Bash, Zsh, sh (default follows `$SHELL`)

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

## Port Forwarding API

Manages long-running `kubectl port-forward` tunnels. Tunnels live until
stopped, until the backend process dies, or until the app quits.

### `portForwardStart(args)`

Starts a tunnel and resolves once kubectl reports it is listening.

- **Arguments** (`PortForwardArgs`):
  - `contextName`: `string`
  - `namespace`: `string`
  - `resourceType`: `'pod' | 'service'`
  - `resourceName`: `string`
  - `localPort`: `number` (1-65535, must not already be forwarded)
  - `remotePort`: `number` (1-65535)
- **Returns**: `Promise<Result<PortForwardInfo>>`
  - `PortForwardInfo`: `PortForwardArgs & { id: string; startedAt: string }`

### `portForwardStop(id)`

Stops a tunnel. Resolves `false` if the id is unknown.

- **Parameters**: `id`: `string`
- **Returns**: `Promise<Result<boolean>>`

### `portForwardList()`

Lists active tunnels.

- **Returns**: `Promise<Result<PortForwardInfo[]>>`

---

## Helm API

Wraps the `helm` CLI through the Helm operations service
(`electron/services/helm/helm-service.ts`). The binary must be on PATH. All
inputs are validated (context, namespace, release/chart/repo names) before any
command runs. These methods back the plugin sandbox's `helm.*` SDK group and
require the `kubernetes` plugin permission when called from a plugin.

### `helmInstall(args)`

Installs a chart as a new release.

- **Arguments**:
  - `contextName`: `string`
  - `namespace`: `string`
  - `releaseName`: `string`
  - `chart`: `string` (e.g., 'bitnami/nginx')
  - `version`: `string` (optional — chart version)
  - `values`: `string` (optional — YAML values passed via a temp file)
  - `createNamespace`: `boolean` (optional)
- **Returns**: `Promise<Result<string>>` — helm CLI output

### `helmUpgrade(args)`

Upgrades an existing release.

- **Arguments**: `contextName`, `namespace`, `releaseName`, `chart`, `version?`, `values?`
- **Returns**: `Promise<Result<string>>`

### `helmRollback(args)`

Rolls a release back to a previous revision.

- **Arguments**: `contextName`, `namespace`, `releaseName`, `revision`: `number`
- **Returns**: `Promise<Result<string>>`

### `helmUninstall(args)`

Uninstalls a release.

- **Arguments**: `contextName`, `namespace`, `releaseName`
- **Returns**: `Promise<Result<string>>`

### `helmRepoAdd(args)`

Adds a chart repository.

- **Arguments**: `name`: `string`, `url`: `string`
- **Returns**: `Promise<Result<string>>`

### `helmRepoList()`

Lists configured chart repositories.

- **Returns**: `Promise<Result<Array<{ name: string; url: string }>>>`

---

## Migration API

Converts a docker-compose file into Kubernetes manifests using the
[kompose](https://kompose.io) CLI (Apache 2.0). The binary must be on
PATH; conversion never writes to disk (`--stdout`), and the result is
imported into the manifest library for review before applying.

### `migrationCheckKompose()`

Probes for the kompose binary. Absence is a valid state, not an error.

- **Returns**: `Promise<Result<KomposeStatus>>`
  - `KomposeStatus`: `{ available: boolean; version?: string }`

### `migrationSelectComposeFile()`

Opens a native file picker filtered to `.yml`/`.yaml` files.

- **Returns**: `Promise<Result<string | null>>` — `null` when cancelled

### `migrationConvertCompose(filePath)`

Runs `kompose convert` on the given compose file. The file must exist,
have a `.yml`/`.yaml` extension, and be at most 1 MiB.

- **Parameters**: `filePath`: `string`
- **Returns**: `Promise<Result<ComposeConversion>>`
  - `ComposeConversion`:
    - `manifests`: `ConvertedManifest[]` — one entry per Kubernetes resource
      (`{ fileName, kind, name, content }`)
    - `warnings`: `string[]` — kompose warnings for keys it could not convert
    - `locallyBuiltImages`: `string[]` — images from `build:` sections that a
      cluster cannot pull (load into kind/minikube or push to a registry
      first)

### `migrationImportManifests(args)`

Saves the converted manifests into the manifest library as a new folder.

- **Arguments** (`MigrationImportArgs`):
  - `projectName`: `string` (folder name, max 100 chars)
  - `contextName`: `string` (validated context name)
  - `manifests`: `{ name: string; content: string }[]` (non-empty, each
    manifest at most 1 MiB)
- **Returns**: `Promise<Result<MigrationImportResult>>`
  - `MigrationImportResult`: `{ folderId: number; manifestIds: number[] }`

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

### `onPortForwardClosed(callback)`

Fires when an established port-forward dies on its own (pod deleted,
connection lost). Not fired for user-requested stops.

- **Callback**: `(info: PortForwardInfo, error?: string) => void`

### `onUpdateStatus(callback)`

Fires as an app update check/download progresses.

- **Callback**: `(status: UpdateStatus) => void`

```typescript
type UpdateStatus =
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string };
```

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
  created_at?: string; // ISO datetime, set by SQLite on insert
}
```

### `MarketplaceEntry`

Returned by `getMarketplacePlugins()`.

```typescript
interface MarketplaceEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  longDescription?: string;
  author: string;
  category:
    | 'Monitoring'
    | 'Security'
    | 'DevTools'
    | 'Networking'
    | 'Themes'
    | 'Logging'
    | 'Storage'
    | 'CI/CD';
  price: number; // 0 for free plugins
  icon: string;
  screenshots: string[];
  rating: number;
  reviews: number;
  downloadUrl: string;
  tags: string[];
  featured?: boolean;
  changelog?: string;
  manifest?: PluginManifest;
}
```
