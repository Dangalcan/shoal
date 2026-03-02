# Project TODOs

This file tracks technical debt, mock logic, and hardcoded values identified in the codebase that require future attention.

## Plugin System

- [ ] **Persistent Registry**: Replace the current in-memory `pluginExtensionsMap` with a persistent database or registry.
  - _Location_: [plugin-context.ts](file:///c:/Users/pc/Desktop/uni3/Kubernetes%20Desktop/electron/services/plugins/plugin-context.ts)
- [ ] **Resource Watching**: Implement the `watchResources` API for plugins.
  - _Location_: [plugin-context.ts](file:///c:/Users/pc/Desktop/uni3/Kubernetes%20Desktop/electron/services/plugins/plugin-context.ts)
- [ ] **Modals**: Implement `openModal` communication with the renderer for plugins.
  - _Location_: [plugin-context.ts](file:///c:/Users/pc/Desktop/uni3/Kubernetes%20Desktop/electron/services/plugins/plugin-context.ts)

## Licensing & Security

- [ ] **License Token Prefix**: Externalize the `OFFLINE-ACTIVATED-` prefix for generated license tokens.
  - _Location_: [license-manager.ts](file:///c:/Users/pc/Desktop/uni3/Kubernetes%20Desktop/electron/services/security/license-manager.ts)
- [ ] **JWT Secret**: Move `JWT_SECRET` from hardcoded fallback to a mandatory secure environment variable.
  - _Location_: [license-service.ts](file:///c:/Users/pc/Desktop/uni3/Kubernetes%20Desktop/marketplace-backend/src/services/license-service.ts)
- [ ] **License Validation**: Replace hardcoded license triggers (`PRO-MARKETPLACE-TEST`, `TRIAL-REQUEST`) with proper database-backed validation.
  - _Location_: [index.ts](file:///c:/Users/pc/Desktop/uni3/Kubernetes%20Desktop/marketplace-backend/src/index.ts)
- [ ] **Trial Logic**: Implement robust backend trial activation and expiration logic.
  - _Location_: [index.ts](file:///c:/Users/pc/Desktop/uni3/Kubernetes%20Desktop/marketplace-backend/src/index.ts)

## Plugin-Specific (Namespace Watcher)

- [ ] **System Namespace Filtering**: Move the hardcoded `kube-` and `default` filtering logic to a configurable setting.
  - _Location_: [index.js](file:///c:/Users/pc/Desktop/uni3/Kubernetes%20Desktop/plugins/namespace-watcher/index.js)
- [ ] **Sidebar Configuration**: Externalize sidebar registration details (id, label, order) so they are not hardcoded in the script.
  - _Location_: [index.js](file:///c:/Users/pc/Desktop/uni3/Kubernetes%20Desktop/plugins/namespace-watcher/index.js)

---
