/**
 * Plugin System Type Definitions
 *
 * Defines all types for the plugin system including manifests, licensing,
 * marketplace metadata, and runtime plugin instances.
 */

// ============================================================================
// Common Types
// ============================================================================

export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// License Types
// ============================================================================

export type PluginLicenseType = 'free' | 'paid' | 'trial' | 'subscription';

export type PricingModel = 'one-time' | 'subscription' | 'freemium';

export interface PluginPricing {
  model: PricingModel;
  price: number;
  currency: string;
  interval?: 'monthly' | 'yearly';
  trialDays?: number;
}

export interface PluginLicense {
  type: PluginLicenseType;
  spdx: string; // SPDX license identifier (e.g., 'MIT', 'Apache-2.0', 'proprietary')
  pricing?: PluginPricing;
}

export interface PluginLicenseInfo {
  isActive: boolean;
  licenseKey?: string;
  activatedAt?: string;
  expiresAt?: string;
  isTrialActive?: boolean;
  trialEndsAt?: string;
  installationId?: string;
  features?: string[];
  lastVerifiedAt?: string;
}

// ============================================================================
// Dependency Types
// ============================================================================

export interface DependencyValidationResult {
  valid: boolean;
  missing: string[]; // Missing plugin IDs
  incompatible: Array<{
    pluginId: string;
    required: string;
    installed: string;
  }>;
  circular: string[][]; // Circular dependency chains
}

// ============================================================================
// Data Loading Types
// ============================================================================

export interface PluginDataFile {
  path: string;
  content: unknown; // Parsed JSON content
}

// ============================================================================
// Marketplace Types
// ============================================================================

export interface PluginMarketplaceInfo {
  category: string;
  tags: string[];
  screenshots?: string[];
  icon?: string;
  minAppVersion?: string;
  rating?: number;
  downloads?: number;
  lastUpdated?: string;
}

export interface PluginReview {
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
  helpful: number;
}

// ============================================================================
// Permission Types
// ============================================================================

export type PluginPermission =
  | 'kubernetes' // Access to Kubernetes API
  | 'filesystem' // File system access
  | 'network' // Network access
  | 'ui' // UI extension capabilities
  | 'storage' // Plugin-specific storage
  | 'notifications'; // Show notifications

// ============================================================================
// Extension Point Types
// ============================================================================

export interface SidebarExtension {
  id: string;
  label: string;
  icon?: string;
  route: string;
  order?: number;
}

export interface ResourceActionExtension {
  id: string;
  label: string;
  icon?: string;
  resourceTypes: string[]; // e.g., ['pod', 'deployment']
  component?: string; // Path to React component
  handler?: string; // Function name in plugin
}

export interface PageExtension {
  id: string;
  route: string;
  component: string; // Path to React component
  title?: string;
}

/**
 * A dashboard widget contributed by a plugin. Declared in the manifest so the
 * host can render it without executing plugin code: each widget is mounted in
 * its own sandboxed iframe (see src/features/plugins/sandbox/PluginFrame).
 */
export interface WidgetExtension {
  id: string;
  title: string;
  size: 'small' | 'medium' | 'large';
}

/**
 * A row action a plugin contributes to resource tables. Declared in the
 * manifest (metadata only) so the host renders the button without executing
 * plugin code. When clicked, the host opens the plugin's action component
 * (registered via `registerResourceAction(id)`) in a sandboxed modal frame,
 * passing the selected resource as props. `id` must match the registered id.
 */
export interface ResourceActionWidget {
  id: string;
  label: string;
  /** lucide-react icon name, e.g. "Rocket". Optional. */
  icon?: string;
  /** Resource types this action applies to, e.g. ['pods']; '*' for all. */
  resourceTypes: string[];
}

export interface PluginExtensions {
  sidebar?: SidebarExtension[];
  resourceActions?: ResourceActionExtension[];
  pages?: PageExtension[];
}

// ============================================================================
// Plugin Manifest
// ============================================================================

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  main?: string; // Entry point (relative to plugin root)
  renderer?: string; // UI Entry point (relative to plugin root)
  styles?: string[]; // UI Stylesheet paths (relative to plugin root)
  permissions?: PluginPermission[];
  license: PluginLicense;
  marketplace?: PluginMarketplaceInfo;
  extensions?: {
    sidebar?: SidebarExtension[];
    widgets?: WidgetExtension[];
    resourceActions?: ResourceActionWidget[];
    // Future: menu, etc.
  };
  configuration?: PluginConfigurationSchema;
  dependencies?: Record<string, string>; // Plugin dependencies (id: semver range)
  data?: string[]; // Paths to data files (relative to plugin root)
}

export interface PluginConfigurationSchema {
  title?: string;
  properties: Record<string, PluginConfigProperty>;
}

export interface PluginConfigProperty {
  type: 'string' | 'number' | 'boolean' | 'select' | 'array';
  label: string;
  description?: string;
  default?: unknown;
  enum?: unknown[]; // For select type
  multiline?: boolean; // For string type
  secret?: boolean; // For passwords/keys
  min?: number; // For number type
  max?: number; // For number type
  required?: boolean;
  placeholder?: string;
  validation?: {
    pattern?: string; // Regex pattern
    message?: string; // Validation error message
  };
}

// ============================================================================
// Plugin Runtime Types
// ============================================================================

export type PluginState =
  | 'disabled'
  | 'enabled'
  | 'loading'
  | 'error'
  | 'trial'
  | 'expired';

export interface Plugin {
  manifest: PluginManifest;
  state: PluginState;
  error?: string;
  licenseInfo?: PluginLicenseInfo;
  installedAt: string;
  updatedAt?: string;
  hasUpdate?: boolean;
  latestVersion?: string;

  // Lifecycle hooks
  beforeActivate?: (context: PluginContext) => Promise<void>;
  activate?: (context: PluginContext) => Promise<void>;
  afterActivate?: (context: PluginContext) => Promise<void>;
  beforeDeactivate?: (context: PluginContext) => Promise<void>;
  deactivate?: () => Promise<void>;
  afterDeactivate?: () => Promise<void>;
  rendererEntry?: string; // Absolute path to renderer entry point
  rendererStyles?: string[]; // Absolute paths to renderer stylesheets
}

// ============================================================================
// Plugin Context & API
// ============================================================================

export interface KubernetesAPI {
  getResources: (type: string, namespace: string) => Promise<unknown[]>;
  createResource: (manifest: unknown) => Promise<void>;
  updateResource: (
    type: string,
    name: string,
    manifest: unknown
  ) => Promise<void>;
  deleteResource: (
    type: string,
    name: string,
    namespace: string
  ) => Promise<void>;
  executeCommand: (
    pod: string,
    namespace: string,
    command: string
  ) => Promise<string>;
  /** Pod CPU/memory usage from metrics-server; [] when unavailable. */
  getPodMetrics: (namespace: string) => Promise<
    Array<{
      namespace: string;
      name: string;
      cpuMillicores: number;
      memoryMi: number;
    }>
  >;
  watchResources: (
    type: string,
    callback: (event: unknown) => void
  ) => () => void;
}

export interface UIAPI {
  registerSidebarItem: (item: SidebarExtension) => void;
  registerPage: (route: string, component: unknown) => void;
  registerResourceAction: (
    resourceType: string,
    action: ResourceActionExtension
  ) => void;
  showNotification: (
    message: string,
    type: 'success' | 'error' | 'info' | 'warning'
  ) => void;
  /**
   * Deduplicated notification: fires showNotification only if no notification
   * with the same `key` fired within `cooldownMs` (default 30 minutes).
   * Returns true when the notification was actually shown. Use for periodic
   * scan findings so users aren't re-alerted on every refresh interval.
   */
  notifyOnce: (
    key: string,
    message: string,
    type: 'success' | 'error' | 'info' | 'warning',
    cooldownMs?: number
  ) => boolean;
  openModal: (component: string, props?: Record<string, unknown>) => void;
}

export interface StorageAPI {
  get: <T = unknown>(key: string) => Promise<T | null>;
  set: <T = unknown>(key: string, value: T) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

export interface LoggerAPI {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}

export interface EventsAPI {
  // Subscribe to events
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  once: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler: (...args: unknown[]) => void) => void;

  // Emit events
  emit: (event: string, ...args: unknown[]) => void;

  // Cross-plugin communication
  broadcast: (event: string, ...args: unknown[]) => void;
  onBroadcast: (event: string, handler: (...args: unknown[]) => void) => void;
  offBroadcast: (event: string, handler: (...args: unknown[]) => void) => void;

  // App lifecycle hooks
  onClusterConnected: (handler: (cluster: unknown) => void) => void;
  onClusterDisconnected: (handler: (cluster: unknown) => void) => void;
  onResourceCreated: (handler: (resource: unknown) => void) => void;
  onResourceUpdated: (handler: (resource: unknown) => void) => void;
  onResourceDeleted: (handler: (resource: unknown) => void) => void;
}

export interface PluginContext {
  pluginId: string;
  pluginPath: string;
  kubernetes: KubernetesAPI;
  ui: UIAPI;
  storage: StorageAPI;
  logger: LoggerAPI;
  events: EventsAPI;
}

// ============================================================================
// Plugin Registry Types
// ============================================================================

export interface PluginConfig {
  enabled: boolean;
  settings?: Record<string, unknown>;
  licenseInfo?: PluginLicenseInfo;
}

export interface PluginRegistryEntry {
  plugin: Plugin;
  config: PluginConfig;
  context?: PluginContext;
}

// ============================================================================
// Marketplace API Types
// ============================================================================

export interface MarketplaceEntry {
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
  price: number;
  icon: string;
  screenshots: string[];
  rating: number;
  reviews: number;
  downloadUrl: string;
  /** Hex SHA-256 of the download archive (optional "sha256:" prefix). */
  checksum?: string;
  tags: string[];
  featured?: boolean;
  changelog?: string;
  manifest?: PluginManifest;
}

export interface MarketplacePlugin {
  manifest: PluginManifest;
  downloadUrl: string;
  signature: string;
  checksum: string;
  reviews: PluginReview[];
}

export interface MarketplaceFilters {
  category?: string;
  tags?: string[];
  priceType?: 'free' | 'paid' | 'all';
  minRating?: number;
  search?: string;
}

export interface PluginInstallOptions {
  enableAfterInstall?: boolean;
}

// ============================================================================
// IPC Result Types
// ============================================================================

export interface PluginListResult {
  plugins: Plugin[];
  total: number;
}

export interface LicenseActivationResult {
  success: boolean;
  licenseInfo?: PluginLicenseInfo;
  error?: string;
}

export interface PluginInstallResult {
  success: boolean;
  pluginId?: string;
  error?: string;
}

// ============================================================================
// IPC Event Types (shared between main process and renderer via preload)
// ============================================================================

export interface PluginNotificationData {
  pluginId: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface PluginModalData {
  pluginId: string;
  component: string;
  props?: Record<string, unknown>;
}

export interface PluginScaffoldOptions {
  id: string;
  name: string;
  author: string;
  description: string;
}
