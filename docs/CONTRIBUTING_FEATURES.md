# Contributing: Adding New Features 🚀

This guide explains how to add new features to the Kubernetes Desktop application following our architectural patterns. Features typically span both the **Backend (Electron Main Process)** and the **Frontend (React Renderer Process)**.

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

**Example**: Add a "Terminal" feature.

#### A. Create a Backend Service

Implement the core logic in `electron/services/`.

**File**: `electron/services/terminal/terminal-service.ts`

```typescript
export class TerminalService {
  async createSession(args: CreateTerminalArgs) {
    // Implementation logic here...
  }
}
export const terminalService = new TerminalService();
```

#### B. Register IPC Handlers

Expose the service via IPC in `electron/ipc/`. Use `wrapIpcHandler` to standardize responses and `assert*` helpers for security validation.

**File**: `electron/ipc/terminal-ipc.ts`

```typescript
import { ipcMain } from 'electron';
import { wrapIpcHandler, assertContext, assertNamespace } from './ipc-utils';
import { terminalService } from '../services/terminal/terminal-service';

export function registerTerminalIpcHandlers() {
  ipcMain.handle(
    'terminal:create',
    wrapIpcHandler('terminal:create', async (event, args) => {
      if (args.kind === 'pod-exec') {
        assertContext(args.contextName);
        assertNamespace(args.namespace);
      }
      return await terminalService.createSession(args);
    })
  );
}
```

#### C. Update Preload Script

Expose the new IPC methods to the renderer in `electron/preload.ts`.

```typescript
contextBridge.exposeInMainWorld('electron', {
  terminalCreate: (args: any) => ipcRenderer.invoke('terminal:create', args),
  // ...
});
```

---

### 2. Implement Frontend Logic

#### A. Create Feature Directory

```bash
mkdir -p src/features/terminal
```

**Structure**:

```
src/features/terminal/
├── TerminalContext.tsx    # Context Provider and Logic
├── components/            # Feature-specific components
├── types.ts              # TypeScript types
└── index.ts              # Public exports
```

#### B. Implement Business Logic Hook

Use `useApi()` to call Electron methods and `useAsyncData` or `handleAsyncOperation` for standardized state management.

**File**: `src/features/terminal/TerminalContext.tsx`

```typescript
import { useApi } from '../../services/api-context';
import { handleAsyncOperation } from '../../lib/async-operation-handler';

export function TerminalProvider({ children }: { children: ReactNode }) {
  const api = useApi();

  const createTerminal = useCallback(
    async (args: any) => {
      return await handleAsyncOperation(() => api.terminalCreate(args), {
        loadingMessage: 'Initializing terminal...',
        successMessage: 'Terminal ready.',
        errorTitle: 'Failed to create terminal',
      });
    },
    [api]
  );

  // ...
}
```

---

### 3. Create UI Components

Use the feature context and shared UI components from `src/components/ui/`.

**File**: `src/features/terminal/components/TerminalView.tsx`

```typescript
import { useTerminal } from '../TerminalContext';

export function TerminalView() {
  const { sessions, activeSessionId } = useTerminal();
  // ... render terminal ...
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
- **Don't put business logic in Pages**: Pages should be thin wrappers that combine features.
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
