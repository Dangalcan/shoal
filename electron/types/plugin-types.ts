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
  content: any; // Parsed JSON content
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
    // Future: dashboard, menu, etc.
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
  default?: any;
  enum?: any[]; // For select type
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
  getResources: (type: string, namespace: string) => Promise<any[]>;
  createResource: (manifest: any) => Promise<void>;
  updateResource: (type: string, name: string, manifest: any) => Promise<void>;
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
  watchResources: (type: string, callback: (event: any) => void) => () => void;
}

export interface UIAPI {
  registerSidebarItem: (item: SidebarExtension) => void;
  registerPage: (route: string, component: any) => void;
  registerResourceAction: (
    resourceType: string,
    action: ResourceActionExtension
  ) => void;
  showNotification: (
    message: string,
    type: 'success' | 'error' | 'info' | 'warning'
  ) => void;
  openModal: (component: any, props?: any) => void;
}

export interface StorageAPI {
  get: <T = any>(key: string) => Promise<T | null>;
  set: <T = any>(key: string, value: T) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

export interface LoggerAPI {
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}

export interface EventsAPI {
  // Subscribe to events
  on: (event: string, handler: (...args: any[]) => void) => void;
  once: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;

  // Emit events
  emit: (event: string, ...args: any[]) => void;

  // App lifecycle hooks
  onClusterConnected: (handler: (cluster: any) => void) => void;
  onClusterDisconnected: (handler: (cluster: any) => void) => void;
  onResourceCreated: (handler: (resource: any) => void) => void;
  onResourceUpdated: (handler: (resource: any) => void) => void;
  onResourceDeleted: (handler: (resource: any) => void) => void;
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
  settings?: Record<string, any>;
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
  author: string;
  category:
    | 'Monitoring'
    | 'Security'
    | 'DevTools'
    | 'Networking'
    | 'Themes'
    | 'Logging';
  price: number;
  icon: string;
  screenshots: string[];
  rating: number;
  reviews: number;
  downloadUrl: string;
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
  skipSignatureVerification?: boolean; // For development only
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
