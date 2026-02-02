# Plugin System Implementation Plan

A comprehensive plugin system with marketplace and licensing support to extend Kubernetes Desktop functionality through both free and paid third-party extensions.

## User Review Required

> [!IMPORTANT]
> **Plugin Architecture Decision**
>
> This plan proposes a **hybrid plugin architecture** with both Node.js-based plugins (running in the main process) and UI-based plugins (React components in the renderer). This provides maximum flexibility but adds complexity.
>
> **Alternative approaches:**
>
> - **UI-only plugins**: Simpler, safer, but limited to UI extensions
> - **Main process only**: More powerful but no UI customization
> - **Separate process plugins**: Maximum isolation but more complex IPC
>
> Please confirm if the hybrid approach is acceptable or if you prefer a simpler model.

> [!IMPORTANT]
> **Marketplace & Monetization Model**
>
> Inspired by Odoo's App Store, this plan includes:
>
> - **Free Plugins**: Open-source plugins (LGPL-3, MIT, Apache-2.0)
> - **Paid Plugins**: Commercial plugins with licensing and activation
> - **Marketplace Commission**: Optional 25% commission for paid plugins sold through official marketplace
> - **License Management**: Per-installation licensing with activation keys
> - **Trial Period**: Optional trial periods for paid plugins
>
> **Licensing Options:**
>
> - One-time purchase per installation
> - Subscription-based (monthly/yearly)
> - Freemium (basic free, premium paid)
> - Enterprise licensing (volume discounts)

> [!WARNING]
> **Security Considerations**
>
> Plugins will have access to:
>
> - Kubernetes API through the app's existing IPC bridge
> - File system (if Node.js plugins are enabled)
> - Electron APIs in the main process
>
> This plan includes:
>
> - Plugin signing and verification (required for marketplace)
> - Manifest-based permissions
> - License validation and anti-piracy measures
> - Marketplace review process for quality and security
> - User approval for sensitive operations
> - Sandboxing for untrusted plugins

> [!IMPORTANT]
> **Plugin Discovery & Distribution**
>
> **Local Plugins:**
>
> - `~/.kubernetes-desktop/plugins/` (user-installed plugins)
> - `<app-path>/plugins/` (bundled plugins)
> - **Any local directory** (via "Load Unpacked Plugin" feature)
>
> **Marketplace Plugins:**
>
> - Official marketplace at `marketplace.kubernetes-desktop.com` (future)
> - Plugin metadata, ratings, reviews, and screenshots
> - Secure download and installation
> - Automatic updates for installed plugins
>
> Each plugin contains:
>
> - `plugin.json` (manifest with license info)
> - `index.js` or `index.ts` (main entry point)
> - `LICENSE` file (license text)
> - Optional UI components, styles, assets
> - Optional signature file for verification

---

## Proposed Changes

### Core Plugin Infrastructure

#### [NEW] [plugin-types.ts](./src/types/plugin-types.ts)

TypeScript type definitions for the plugin system:

- `PluginManifest`: Plugin metadata (name, version, author, permissions, entry points, **license info, pricing**)
- `Plugin`: Runtime plugin instance with lifecycle methods
- `PluginContext`: API surface available to plugins
- `PluginExtensionPoint`: UI extension points (sidebar items, pages, resource actions, etc.)
- `PluginAPI`: Methods plugins can call to interact with the app
- `PluginPermission`: Permission types (kubernetes, filesystem, network, ui)
- `PluginLicense`: License types (free, paid, trial, subscription)
- `PluginLicenseInfo`: License activation and validation data
- `PluginMarketplaceInfo`: Marketplace metadata (price, ratings, downloads, screenshots)

#### [NEW] [license-manager.ts](./electron/license-manager.ts)

License validation and management system:

- Validates license keys for paid plugins
- Checks license expiration and subscription status
- Handles trial period activation and expiration
- Stores encrypted license data locally
- Communicates with license server for activation
- Prevents license key sharing and piracy
- Supports offline license validation (grace period)
- Manages license transfers and deactivation

#### [NEW] [marketplace-client.ts](./electron/marketplace-client.ts)

Marketplace API client:

- Fetches plugin catalog from marketplace server
- Downloads plugin packages securely
- Verifies plugin signatures and checksums
- Handles plugin installation from marketplace
- Manages plugin updates and version checking
- Submits usage analytics (with user consent)
- Handles purchase transactions and license activation
- Manages plugin ratings and reviews

#### [NEW] [plugin-signature.ts](./electron/plugin-signature.ts)

Plugin signing and verification:

- Verifies plugin signatures using public key cryptography
- Validates plugin integrity and authenticity
- Checks for tampering or modification
- Manages trusted publisher certificates
- Handles signature creation for plugin developers (CLI tool)
- Supports both marketplace-signed and self-signed plugins
- Warns users about unsigned or untrusted plugins

#### [NEW] [plugin-loader.ts](./electron/plugin-loader.ts)

Main process plugin loader:

- Discovers plugins from configured directories
- Validates plugin manifests against schema
- Loads plugin code securely
- Manages plugin lifecycle (load, enable, disable, unload)
- Handles plugin errors and crashes gracefully
- Provides plugin isolation and sandboxing

#### [NEW] [plugin-registry.ts](./electron/plugin-registry.ts)

Plugin registry and state management:

- Maintains list of installed plugins
- Tracks plugin state (enabled/disabled/error)
- Persists plugin configuration
- Provides plugin query and lookup methods
- Manages plugin dependencies

#### [NEW] [plugin-context.ts](./electron/plugin-context.ts)

Plugin context and API bridge:

- Creates isolated context for each plugin
- Exposes safe API surface to plugins
- Wraps Kubernetes operations with permission checks
- Provides logging, storage, and utility functions
- Handles plugin-to-app communication

---

### Frontend Plugin Support

#### [NEW] [PluginProvider.tsx](./src/features/plugins/PluginProvider.tsx)

React context provider for plugins:

- Fetches available plugins from main process
- Manages plugin state in React
- Provides plugin hooks to components
- Handles plugin UI registration
- Triggers plugin lifecycle events

#### [NEW] [usePlugins.ts](./src/features/plugins/usePlugins.ts)

React hook for accessing plugins:

- `usePlugins()`: Get all enabled plugins
- `usePluginExtensions(extensionPoint)`: Get extensions for a specific point
- `usePluginAction(pluginId, actionId)`: Execute plugin action
- `usePluginState(pluginId)`: Get plugin-specific state

#### [NEW] [PluginExtensionRenderer.tsx](./src/components/plugins/PluginExtensionRenderer.tsx)

Component to render plugin UI extensions:

- Dynamically loads plugin React components
- Handles plugin rendering errors
- Provides error boundaries for plugin UI
- Supports lazy loading and code splitting

#### [NEW] [Plugins.tsx](./src/pages/Plugins.tsx)

Plugin management page:

- Lists all installed plugins with metadata
- Shows plugin status (enabled/disabled/error/trial/expired)
- Allows enabling/disabling plugins
- Displays plugin settings and configuration
- Shows plugin permissions and capabilities
- **Displays license status and expiration dates**
- **Provides license activation UI for paid plugins**
- **Shows trial period remaining for trial plugins**
- Provides plugin installation/removal UI

#### [NEW] [PluginStore.tsx](./src/pages/PluginStore.tsx)

Plugin marketplace/store page:

- Displays plugin catalog from marketplace
- Shows plugin cards with screenshots, ratings, and pricing
- Filters plugins by category, price (free/paid), and rating
- Search functionality for finding plugins
- Plugin detail view with full description and reviews
- **Purchase flow for paid plugins**
- **Trial activation for plugins with trial periods**
- One-click installation for free plugins
- Shows installed status and update availability
- Displays user reviews and ratings
- Links to plugin documentation and support

#### [NEW] [PluginLicenseModal.tsx](./src/components/modals/PluginLicenseModal.tsx)

License activation modal:

- Input field for license key entry
- License validation and activation
- Displays license information (type, expiration, features)
- Handles license errors and invalid keys
- Shows purchase link for unlicensed plugins
- Supports license transfer and deactivation

---

### IPC Communication Layer

#### [MODIFY] [preload.ts](./electron/preload.ts)

Add plugin-related IPC methods:

**Plugin Management:**

- `getPlugins()`: Get list of installed plugins
- `enablePlugin(pluginId)`: Enable a plugin
- `disablePlugin(pluginId)`: Disable a plugin
- `getPluginExtensions(extensionPoint)`: Get extensions for a point
- `executePluginAction(pluginId, actionId, args)`: Execute plugin action
- `getPluginSettings(pluginId)`: Get plugin settings
- `setPluginSettings(pluginId, settings)`: Update plugin settings
- `uninstallPlugin(pluginId)`: Uninstall a plugin

**Licensing:**

- `activatePluginLicense(pluginId, licenseKey)`: Activate a paid plugin license
- `deactivatePluginLicense(pluginId)`: Deactivate/transfer license
- `validatePluginLicense(pluginId)`: Check license validity
- `getPluginLicenseInfo(pluginId)`: Get license details
- `startPluginTrial(pluginId)`: Activate trial period

**Marketplace:**

- `getMarketplacePlugins(filters)`: Browse marketplace catalog
- `getPluginDetails(pluginId)`: Get detailed plugin info from marketplace
- `downloadPlugin(pluginId)`: Download plugin from marketplace
- `installPlugin(pluginPath)`: Install downloaded plugin
- `checkPluginUpdates()`: Check for plugin updates
- `updatePlugin(pluginId)`: Update a plugin to latest version
- `submitPluginReview(pluginId, rating, review)`: Submit user review
- `purchasePlugin(pluginId, paymentInfo)`: Purchase paid plugin (redirects to payment gateway)

#### [MODIFY] [main.ts](./electron/main.ts)

Add IPC handlers for plugin operations:

- Initialize plugin loader on app startup
- Register IPC handlers for plugin management
- Handle plugin lifecycle events
- Manage plugin permissions and security
- Provide plugin API access to loaded plugins

#### [MODIFY] [types.d.ts](./src/types.d.ts)

Extend `ElectronAPI` interface with plugin methods to maintain type safety across IPC bridge.

---

### UI Integration Points

#### [MODIFY] [Sidebar.tsx](./src/components/Sidebar.tsx)

Add plugin sidebar items:

- Query plugins for sidebar extensions
- Render plugin-contributed navigation items
- Handle plugin route navigation
- Show plugin icons and labels

#### [MODIFY] [App.tsx](./src/App.tsx)

Add plugin routes:

- Dynamically register plugin-contributed routes
- Render plugin pages
- Add route to plugin management page (`/plugins`)

#### [MODIFY] [Layout.tsx](./src/layouts/Layout.tsx)

Wrap with `PluginProvider`:

- Initialize plugin system on app load
- Provide plugin context to all components
- Handle plugin errors globally

#### [MODIFY] [ClusterDetails.tsx](./src/pages/ClusterDetails.tsx)

Add plugin resource actions:

- Query plugins for resource action extensions
- Render plugin-contributed action buttons
- Execute plugin actions on resources
- Show plugin-specific resource views

---

### Plugin API Surface

#### [NEW] [plugin-api.ts](./electron/plugin-api.ts)

Define the API available to plugins:

**Kubernetes Operations:**

- `kubernetes.getResources(type, namespace)`: Get Kubernetes resources
- `kubernetes.createResource(manifest)`: Create a resource
- `kubernetes.updateResource(type, name, manifest)`: Update a resource
- `kubernetes.deleteResource(type, name, namespace)`: Delete a resource
- `kubernetes.executeCommand(pod, command)`: Execute command in pod
- `kubernetes.watchResources(type, callback)`: Watch resource changes

**UI Extensions:**

- `ui.registerSidebarItem(item)`: Add sidebar navigation item
- `ui.registerPage(route, component)`: Register a new page
- `ui.registerResourceAction(resourceType, action)`: Add resource action button
- `ui.showNotification(message, type)`: Show toast notification
- `ui.openModal(component, props)`: Open a modal dialog

**Storage:**

- `storage.get(key)`: Get plugin-specific stored data
- `storage.set(key, value)`: Store plugin data
- `storage.delete(key)`: Delete stored data

**Utilities:**

- `logger.info/warn/error(message)`: Logging functions
- `events.on(event, handler)`: Subscribe to app events
- `events.emit(event, data)`: Emit custom events

---

### Example Plugin Structure

```
~/.kubernetes-desktop/plugins/my-plugin/
├── plugin.json              # Plugin manifest
├── index.js                 # Main entry point (Node.js)
├── ui/
│   ├── PluginPage.tsx      # React component for plugin page
│   └── ResourceAction.tsx  # React component for resource action
├── assets/
│   └── icon.svg            # Plugin icon
└── README.md               # Plugin documentation
```

**Example plugin.json:**

```json
{
  "id": "my-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "description": "Adds cool features to Kubernetes Desktop",
  "author": "Plugin Developer",
  "homepage": "https://example.com/my-plugin",
  "repository": "https://github.com/developer/my-plugin",
  "main": "index.js",
  "permissions": ["kubernetes", "ui"],
  "license": {
    "type": "paid",
    "spdx": "proprietary",
    "pricing": {
      "model": "subscription",
      "price": 9.99,
      "currency": "USD",
      "interval": "monthly",
      "trialDays": 14
    }
  },
  "marketplace": {
    "category": "monitoring",
    "tags": ["kubernetes", "monitoring", "alerts"],
    "screenshots": ["assets/screenshot1.png", "assets/screenshot2.png"],
    "icon": "assets/icon.svg",
    "minAppVersion": "1.0.0"
  },
  "extensions": {
    "sidebar": [
      {
        "id": "my-page",
        "label": "My Plugin",
        "icon": "assets/icon.svg",
        "route": "/plugin/my-plugin"
      }
    ],
    "resourceActions": [
      {
        "id": "my-action",
        "label": "Custom Action",
        "resourceTypes": ["pod"],
        "component": "ui/ResourceAction.tsx"
      }
    ]
  }
}
```

**Example for Free Plugin:**

```json
{
  "id": "free-plugin",
  "name": "Free Kubernetes Helper",
  "version": "2.1.0",
  "description": "Open-source utilities for Kubernetes",
  "author": "Community Developer",
  "main": "index.js",
  "permissions": ["kubernetes", "ui"],
  "license": {
    "type": "free",
    "spdx": "MIT"
  },
  "marketplace": {
    "category": "utilities",
    "tags": ["kubernetes", "tools", "free"],
    "icon": "assets/icon.svg"
  },
  "extensions": {
    "sidebar": [
      {
        "id": "helper-page",
        "label": "K8s Helper",
        "route": "/plugin/free-plugin"
      }
    ]
  }
}
```

**Example index.js:**

```javascript
module.exports = {
  async activate(context) {
    console.log('My plugin activated!');

    // Register a sidebar item
    context.ui.registerSidebarItem({
      id: 'my-page',
      label: 'My Plugin',
      route: '/plugin/my-plugin',
    });

    // Register a resource action
    context.ui.registerResourceAction('pod', {
      id: 'restart-pod',
      label: 'Quick Restart',
      handler: async (resource) => {
        await context.kubernetes.deleteResource(
          'pod',
          resource.metadata.name,
          resource.metadata.namespace
        );
        context.ui.showNotification('Pod restarted!', 'success');
      },
    });
  },

  async deactivate() {
    console.log('My plugin deactivated!');
  },
};
```

---

## Marketplace Backend Infrastructure

> [!NOTE]
> The marketplace backend is a separate service that will be developed alongside the desktop application. This section outlines the required components.

### Backend Services (Future Implementation)

**Marketplace API Server:**

- RESTful API for plugin catalog, search, and filtering
- Plugin upload and publishing workflow
- User authentication and authorization
- Payment processing integration (Stripe, PayPal)
- License key generation and validation API
- Download tracking and analytics
- Review and rating system
- Plugin version management

**Database Schema:**

- Plugins table (metadata, pricing, downloads, ratings)
- Users table (developers and customers)
- Licenses table (activation keys, expiration, installations)
- Reviews table (ratings, comments, helpful votes)
- Transactions table (purchases, refunds)
- Analytics table (downloads, activations, usage)

**CDN & Storage:**

- Plugin package hosting (S3, CloudFront)
- Screenshot and asset hosting
- Signature and checksum storage
- Automatic backup and versioning

**Security:**

- Plugin code scanning for malware
- Automated security audits
- Manual review process for marketplace submissions
- Rate limiting and DDoS protection
- Encrypted license storage

### Developer Portal (Future)

**Plugin Developer Dashboard:**

- Plugin upload and publishing interface
- Sales and revenue analytics
- License management and revocation
- Customer support ticket system
- Payout management (for paid plugins)
- Plugin performance metrics
- Version management and rollback

**CLI Tools for Developers:**

- `kd-plugin init`: Scaffold new plugin project
- `kd-plugin dev`: Run plugin in development mode
- `kd-plugin build`: Build and package plugin
- `kd-plugin sign`: Sign plugin for marketplace
- `kd-plugin publish`: Upload plugin to marketplace
- `kd-plugin validate`: Validate plugin manifest and code

---

## Verification Plan

### Automated Tests

**Plugin Loader Tests** (`electron/__tests__/plugin-loader.test.ts`):

- Test plugin discovery from directories
- Test manifest validation
- Test plugin loading and unloading
- Test error handling for invalid plugins
- Test plugin isolation

**Plugin Registry Tests** (`electron/__tests__/plugin-registry.test.ts`):

- Test plugin registration and lookup
- Test plugin state management
- Test plugin configuration persistence

**Plugin Context Tests** (`electron/__tests__/plugin-context.test.ts`):

- Test API surface exposure
- Test permission checking
- Test plugin API calls

**Frontend Plugin Tests** (`src/test/features/plugins/`):

- Test `PluginProvider` initialization
- Test `usePlugins` hook
- Test plugin extension rendering
- Test plugin action execution

### Manual Verification

**Example Plugin Creation:**

1. Create a simple example plugin following the structure above
2. Place it in `~/.kubernetes-desktop/plugins/example-plugin/`
3. Restart the application
4. Verify plugin appears in plugin management page
5. Enable the plugin
6. Verify plugin sidebar item appears
7. Navigate to plugin page
8. Test plugin resource action on a pod
9. Disable the plugin
10. Verify plugin UI elements are removed

**Integration Testing:**

1. Test multiple plugins loaded simultaneously
2. Test plugin conflicts and error handling
3. Test plugin updates and hot-reloading (if implemented)
4. Test plugin permissions and security restrictions
5. Verify plugin state persistence across app restarts

**Performance Testing:**

1. Load 10+ plugins and measure startup time
2. Test plugin UI rendering performance
3. Monitor memory usage with plugins enabled
4. Test plugin cleanup on disable/unload

---

## Phased Implementation Roadmap

Given the scope of this plugin system with marketplace and licensing, we recommend a phased approach:

### Phase 1: Core Plugin System (MVP)

**Goal:** Basic plugin loading and UI extensions

- Plugin type definitions and manifest schema
- Plugin loader and registry
- Plugin discovery from local directories
- Basic permission system
- UI extension points (sidebar, pages)
- Plugin management page (enable/disable)
- Example free plugin

**Timeline:** 2-3 weeks

### Phase 2: Licensing & Monetization

**Goal:** Support for paid plugins with local licensing

- License manager and validation
- Trial period support
- License activation UI
- Offline license validation
- Plugin signing and verification
- Example paid plugin with trial

**Timeline:** 2-3 weeks

### Phase 3: Marketplace Integration (Client)

**Goal:** Browse and install plugins from marketplace

- Marketplace API client
- Plugin store UI page
- Plugin download and installation
- Plugin updates and version management
- Search and filtering
- Mock marketplace API for testing

**Timeline:** 2-3 weeks

### Phase 4: Marketplace Backend (Future)

**Goal:** Full marketplace infrastructure

- Marketplace API server
- Payment processing integration
- Developer portal and dashboard
- Plugin review and approval workflow
- Analytics and reporting
- CLI tools for developers

**Timeline:** 4-6 weeks (separate project)

### Phase 5: Advanced Features (Future)

**Goal:** Enhanced plugin ecosystem

- Plugin dependencies
- Hot reloading
- Remote plugins (npm, URLs)
- Plugin analytics
- Advanced sandboxing
- Plugin templates and scaffolding

**Timeline:** Ongoing

---

## Migration & Compatibility

- No breaking changes to existing functionality
- Plugin system is opt-in and disabled by default
- Existing features work without any plugins installed
- Plugin API versioning for future compatibility

---

## Future Enhancements

- **Plugin Marketplace**: Web-based plugin discovery and installation
- **Hot Reloading**: Update plugins without restarting the app
- **Plugin Dependencies**: Allow plugins to depend on other plugins
- **Remote Plugins**: Load plugins from URLs or npm packages
- **Plugin Signing**: Verify plugin authenticity and integrity
- **Advanced Sandboxing**: Run plugins in separate processes for better isolation
- **Plugin Analytics**: Track plugin usage and performance
- **Plugin Templates**: CLI tool to scaffold new plugins
