# Contributing: Adding New Features 🚀

This guide explains how to add new features to the Kubernetes Desktop application following our architectural patterns.

---

## Architecture Overview

Our application follows a **clean architecture** pattern with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer (Pages)                      │
│  - Minimal logic, mostly JSX                            │
│  - Event handlers that call business logic              │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│              Business Logic Layer (Hooks)                │
│  - Custom hooks in src/features/                        │
│  - State management, data fetching, validation          │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│                 Service Layer (API)                      │
│  - useApi() hook for Electron API access               │
│  - Dependency injection via ApiProvider                 │
└─────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Feature Addition

### 1. Define Your Feature

**Example**: Add a "Cluster Management" feature

**Requirements**:

- List all available clusters
- Switch between kubeconfig contexts
- Delete clusters with confirmation
- Persist default namespace preference

---

### 2. Create Feature Directory

```bash
mkdir -p src/features/clusters
```

**Structure**:

```
src/features/clusters/
├── ClusterContext.tsx    # Context Provider and Logic
├── types.ts              # TypeScript types
└── index.ts              # Public exports
```

---

### 3. Define Types

**File**: `src/features/clusters/types.ts`

```typescript
import { Result } from '../../types/result';

export interface ClusterState {
  clusters: string[];
  loading: boolean;
  currentContext: string;
  switching: string | null;
  deleting: string | null;
}

export interface ClusterContextValue extends ClusterState {
  fetchClusters: () => Promise<void>;
  switchContext: (contextName: string) => Promise<Result<void>>;
  deleteCluster: (name: string) => Promise<Result>;
}
```

---

### 4. Implement Business Logic Hook (via Context Provider)

**File**: `src/features/clusters/ClusterContext.tsx`

```typescript
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { useApi } from '../../services/api-context';
import { handleAsyncOperation } from '../../lib/async-operation-handler';
import { useAsyncData } from '../../hooks/useAsyncData';

// ... setup context ...

export function ClusterProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [currentContext, setCurrentContext] = useState<string>('');

  // Data fetching using useAsyncData hook
  const {
    data: clusters,
    loading,
    refetch: fetchClusters,
  } = useAsyncData({
    fetchFn: () => api.getClusters(),
    errorTitle: 'Failed to fetch clusters',
  });

  // Action: Switch context
  const switchContext = useCallback(
    async (contextName: string) => {
      return await handleAsyncOperation(() => api.switchContext(contextName), {
        loadingMessage: `Switching to context "${contextName}"...`,
        successMessage: `Switched to context "${contextName}".`,
        onSuccess: () => setCurrentContext(contextName),
      });
    },
    [api]
  );

  // ... provide context value ...
}
```

---

### 5. Create UI Component

**File**: `src/components/cluster/ClusterCard.tsx`

```typescript
import { Settings, Trash2 } from 'lucide-react';
import { Card, Button, Badge } from '../ui';
import { useClusterContext } from '../../features/clusters';

interface ClusterCardProps {
  name: string;
}

export function ClusterCard({ name }: ClusterCardProps) {
  const { currentContext, switching, deleting, switchContext, deleteCluster } = useClusterContext();
  const isActive = name === currentContext;

  return (
    <Card className={isActive ? 'border-primary' : ''}>
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{name}</h3>
        <div className="flex gap-2">
          {isActive && <Badge variant="success">Active</Badge>}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteCluster(name)}
            disabled={!!deleting}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
      <Button
        variant={isActive ? 'secondary' : 'primary'}
        onClick={() => switchContext(name)}
        disabled={!!switching || isActive}
      >
        {isActive ? 'Current' : 'Switch'}
      </Button>
    </Card>
  );
}
```

---

### 6. Integrate into Page

**File**: `src/pages/Clusters.tsx`

```typescript
import { ClusterCard } from '../components/cluster/ClusterCard';
import { useClusterContext } from '../features/clusters';

export function Clusters() {
  const { clusters, loading } = useClusterContext();

  if (loading && clusters.length === 0) {
    return <div>Loading clusters...</div>;
  }

  return (
    <div className="clusters-grid">
      {clusters.map(name => (
        <ClusterCard key={name} name={name} />
      ))}
    </div>
  );
}
```

---

## Provider Setup

Essential features that use Context must be wrapped in their provider in `src/App.tsx` or a parent layout.

**File**: `src/layouts/Layout.tsx`

```typescript
import { ClusterProvider } from '../features/clusters';

export function Layout() {
  return (
    <ClusterProvider>
      <div className="app-layout">
        <Sidebar />
        <main>
          <Outlet />
        </main>
      </div>
    </ClusterProvider>
  );
}
```

---

## Best Practices

### ✅ DO

- **Use `useApi()` for all Electron API access**

  ```typescript
  const api = useApi();
  const result = await api.someMethod();
  ```

- **Extract business logic to custom hooks**

  ```typescript
  // ✅ Good: Logic in hook
  function MyPage() {
    const logic = useMyFeatureLogic();
    return <MyView {...logic} />;
  }
  ```

- **Use `useAsyncData` for data fetching**

  ```typescript
  const { data, loading, error, refetch } = useAsyncData({
    fetchFn: async () => {
      /* ... */
    },
    errorTitle: 'Operation Failed',
  });
  ```

- **Handle errors gracefully**
  ```typescript
  if (result.success) {
    // Handle success
  } else {
    handleError(new Error(result.error), 'Operation Failed');
  }
  ```

### ❌ DON'T

- **Don't access `window.electron` directly**

  ```typescript
  // ❌ Bad
  const result = await window.electron.getClusters();

  // ✅ Good
  const api = useApi();
  const result = await api.getClusters();
  ```

- **Don't put business logic in components**

  ```typescript
  // ❌ Bad: Logic in component
  function MyPage() {
    const [data, setData] = useState();
    useEffect(() => {
      // Complex logic here
    }, []);
  }

  // ✅ Good: Logic in hook
  function MyPage() {
    const { data } = useMyData();
  }
  ```

- **Don't ignore loading/error states**

  ```typescript
  // ❌ Bad
  return <div>{data.value}</div>;

  // ✅ Good
  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <div>{data.value}</div>;
  ```

---

## Common Patterns

### Pattern 1: Data Fetching with Auto-Refresh

```typescript
const { data, loading, error, refetch } = useAsyncData({
  fetchFn: async () => {
    const result = await api.getData();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  errorTitle: 'Failed to load data',
  autoRefreshInterval: 30000, // Refresh every 30s
  dependencies: [someParam], // Refetch when param changes
});
```

### Pattern 2: Form Submission

```typescript
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();

  const result = await handleAsyncOperation(() => api.submitForm(formData), {
    loadingMessage: 'Submitting...',
    successMessage: 'Success!',
    errorTitle: 'Submission Failed',
    onSuccess: () => navigate('/success'),
  });
};
```

### Pattern 3: Conditional Rendering

```typescript
if (loading && !data) {
  return <Spinner label="Loading..." />;
}

if (error) {
  return (
    <Card>
      <p className="text-error">{error}</p>
      <Button onClick={refetch}>Try Again</Button>
    </Card>
  );
}

if (!data || data.length === 0) {
  return <EmptyState message="No data found" />;
}

return <DataView data={data} />;
```

---

## File Naming Conventions

- **Hooks**: `use[FeatureName].ts` (e.g., `useClusterHealth.ts`)
- **Components**: `PascalCase.tsx` (e.g., `ClusterHealthCard.tsx`)
- **Types**: `types.ts` or `[feature].types.ts`
- **Styles**: Match component name (e.g., `ClusterHealthCard.css`)

---

## Next Steps

1. ✅ Read [Testing Guide](./CONTRIBUTING_TESTS.md)
2. ✅ Read [Styling Guide](./CONTRIBUTING_STYLES.md)
3. ✅ Check existing features in `src/features/` for examples
4. ✅ Run tests: `npm run test`
5. ✅ Run linter: `npm run lint`
