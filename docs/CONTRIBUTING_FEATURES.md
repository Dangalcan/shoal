# Contributing: Adding New Features 🚀

This guide explains how to add new features to the Shoal application following our architectural patterns. Features typically span both the **Backend (Electron Main Process)** and the **Frontend (React Renderer Process)**.

---

## Architecture Overview

Our application follows a **clean architecture** pattern with clear separation of concerns across the IPC bridge:

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer (Pages)                      │
│  - Minimal logic, mostly JSX                            │
│  - Custom hooks in src/features/ for business logic     │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│                 Service Layer (Frontend)                 │
│  - useApi() hook for Electron API access               │
│  - Standardized Result<T> handling                     │
└──────────────────┬──────────────────────────────────────┘
                   │ [IPC BRIDGE]
┌──────────────────▼──────────────────────────────────────┐
│                 Service Layer (Backend)                  │
│  - IPC Handlers in electron/ipc/                        │
│  - Business logic in electron/services/                 │
│  - Security validation and argument sanitization        │
└─────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Feature Addition

### 1. Define Your Feature (Backend)

Most features start with a new capability in the Electron main process.

**Example**: the "Port Forwarding" feature, as it exists in the repository.

#### A. Create a Backend Service

Implement the core logic in `electron/services/`.

**File**: `electron/services/portforward/portforward-service.ts`

```typescript
export interface PortForwardArgs {
  contextName: string;
  namespace: string;
  resourceType: 'pod' | 'service';
  resourceName: string;
  localPort: number;
  remotePort: number;
}

export class PortForwardService {
  async startForward(
    args: PortForwardArgs,
    onClosed: (info: PortForwardInfo, error?: string) => void
  ): Promise<PortForwardInfo> {
    // Validate the arguments, spawn `kubectl port-forward`, track the tunnel.
  }
}
export const portForwardService = new PortForwardService();
```

#### B. Register IPC Handlers

Expose the service via IPC in `electron/ipc/`. Use `wrapIpcHandler` to standardize responses and `assert*` helpers (or the service's own validation) before anything reaches a shell command.

**File**: `electron/ipc/portforward-ipc.ts`

```typescript
import { ipcMain } from 'electron';
import { wrapIpcHandler } from './ipc-utils';
import {
  portForwardService,
  PortForwardArgs,
} from '../services/portforward/portforward-service';

export function registerPortForwardIpcHandlers(): void {
  ipcMain.handle(
    'portforward:start',
    wrapIpcHandler('portforward:start', async (event, args: PortForwardArgs) =>
      portForwardService.startForward(args, (info, error) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('portforward:closed', { info, error });
        }
      })
    )
  );
}
```

#### C. Update Preload Script

Expose the new IPC methods to the renderer in `electron/preload.ts`, and add their types to `src/types.d.ts` (`ElectronAPI`), the mock in `src/test/utils/mocks.ts` and `docs/API_REFERENCE.md`.

```typescript
contextBridge.exposeInMainWorld('electron', {
  portForwardStart: (args: PortForwardArgs) =>
    ipcRenderer.invoke('portforward:start', args),
  // ...
});
```

---

### 2. Implement Frontend Logic

#### A. Create Feature Directory

```bash
mkdir -p src/features/portforward
```

**Structure**:

```
src/features/portforward/
├── usePortForwards.ts     # Business logic hook (list, start, stop)
└── port-utils.ts          # Pure helpers (port suggestions, validation)
```

#### B. Implement Business Logic Hook

Use `useApi()` to call Electron methods and `useAsyncData` or `handleAsyncOperation` for standardized state management.

**File**: `src/features/portforward/usePortForwards.ts`

```typescript
import { useCallback } from 'react';
import { useApi } from '../../services/api-context';
import { handleAsyncOperation } from '../../lib/async-operation-handler';
import type { PortForwardArgs } from '../../types';

export function usePortForwards() {
  const api = useApi();

  const start = useCallback(
    (args: PortForwardArgs) =>
      handleAsyncOperation(() => api.portForwardStart(args), {
        loadingMessage: 'Starting port forward...',
        successMessage: 'Port forward started.',
        errorTitle: 'Failed to start port forward',
      }),
    [api]
  );

  // ...
}
```

---

### 3. Create UI Components

Use the feature hook and shared UI components from `src/components/ui/`.

**File**: `src/pages/PortForwards.tsx`

```typescript
import { usePortForwards } from '../features/portforward/usePortForwards';

export function PortForwards() {
  const { forwards, stop } = usePortForwards();
  // ... render the table of tunnels ...
}
```

---

## Best Practices

### ✅ DO (Backend)

- **Use `wrapIpcHandler`**: Ensures all responses follow the `{ success, data, error }` pattern and provides automatic logging.
- **Validate Arguments**: Always use `assertContext`, `assertNamespace`, `assertResourceName`, etc., from `ipc-utils.ts` before using arguments in shell commands or filesystem calls.
- **Isolate Logic**: Keep IPC handlers thin; put complex logic in `electron/services/`.
- **Handle Errors**: Use `try/catch` and return meaningful error messages that `wrapIpcHandler` will format for the frontend.

### ✅ DO (Frontend)

- **Use `useApi()`**: Avoid direct `window.electron` access to enable better mock-based testing.
- **Use `handleAsyncOperation`**: Standardizes the "Loading -> Success/Error" toast flow for user actions.
- **Use `useAsyncData`**: Standardizes data fetching with automatic loading states, error handling, and optional auto-refresh.
- **Leverage Types**: Use the `Result<T>` type for all IPC-adjacent logic.

### ❌ DON'T

- **Don't skip validation**: Never pass renderer-provided strings directly to `exec` or `spawn` without validation.
- **Don't put business logic in Pages**: Pages should be thin wrappers that combine features. `src/pages/ClusterDetails.tsx` and `src/pages/Manifests.tsx` are the reference: each reads one page hook (`src/features/clusters/useClusterDetails.ts`, `src/features/manifests/useManifestsPage.ts`) and renders components; the hooks compose smaller ones (tabs, deletion, editor, import, folder dialogs) that are tested on their own.
- **Don't ignore the `Result` wrapper**: Always check `result.success` before accessing `result.data`.

---

## Extending via Plugins

New features can also be contributed as plugins. Plugins can extend the UI via:

- **Sidebar**: Adding new navigation items.
- **Resource Actions**: Adding custom context menu actions (e.g., "Analyze Pod").
- **Pages**: Contributing entire new views.

See [Plugins Guide](./PLUGINS_GUIDE.md) and [Plugin Architecture](./PLUGIN_ARCHITECTURE.md) for details.

---

## File Naming Conventions

- **Main Process Services**: `[name]-service.ts`
- **IPC Handlers**: `[name]-ipc.ts`
- **React Hooks**: `use[FeatureName].ts`
- **Components**: `PascalCase.tsx`
- **Types**: `types.ts`

---

## Next Steps

1. ✅ Read [API Reference](./API_REFERENCE.md) for available IPC methods.
2. ✅ Read [Testing Guide](./CONTRIBUTING_TESTS.md).
3. ✅ Check existing features in `src/features/` and IPC handlers in `electron/ipc/`.
4. ✅ Read [Styling Guide](./CONTRIBUTING_STYLES.md)
5. ✅ Run tests: `npm run test`
6. ✅ Run linter: `npm run lint`
