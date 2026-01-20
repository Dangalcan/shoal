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

**Example**: Add a "Cluster Health Check" feature

**Requirements**:

- Display health status for each cluster
- Show CPU/Memory usage
- Refresh every 30 seconds

---

### 2. Create Feature Directory

```bash
mkdir -p src/features/cluster-health
```

**Structure**:

```
src/features/cluster-health/
├── useClusterHealth.ts    # Business logic hook
├── types.ts               # TypeScript types
└── index.ts               # Public exports
```

---

### 3. Define Types

**File**: `src/features/cluster-health/types.ts`

```typescript
export interface ClusterHealth {
  clusterName: string;
  status: 'healthy' | 'warning' | 'critical';
  cpuUsage: number;
  memoryUsage: number;
  lastChecked: string;
}

export interface UseClusterHealthResult {
  health: ClusterHealth | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
```

---

### 4. Implement Business Logic Hook

**File**: `src/features/cluster-health/useClusterHealth.ts`

```typescript
import { useCallback } from 'react';
import { useApi } from '../../services/api-context';
import { useAsyncData } from '../../hooks/useAsyncData';
import type { ClusterHealth, UseClusterHealthResult } from './types';

export function useClusterHealth(clusterName: string): UseClusterHealthResult {
  const api = useApi();

  const fetchFn = useCallback(async (): Promise<ClusterHealth> => {
    // Call Electron API
    const result = await api.getClusterHealth(clusterName);

    if (result.success) {
      return result.data;
    }

    throw new Error(result.error);
  }, [api, clusterName]);

  const { data, loading, error, refetch } = useAsyncData({
    fetchFn,
    errorTitle: 'Failed to fetch cluster health',
    autoRefreshInterval: 30000, // 30 seconds
    dependencies: [clusterName],
  });

  return {
    health: data,
    loading,
    error,
    refresh: refetch,
  };
}
```

---

### 5. Create UI Component

**File**: `src/components/cluster/ClusterHealthCard.tsx`

```typescript
import { RefreshCw } from 'lucide-react';
import { Card, Badge, Button, Spinner } from '../ui';
import { useClusterHealth } from '../../features/cluster-health';

interface ClusterHealthCardProps {
  clusterName: string;
}

export function ClusterHealthCard({ clusterName }: ClusterHealthCardProps) {
  const { health, loading, error, refresh } = useClusterHealth(clusterName);

  if (loading && !health) {
    return <Spinner label="Loading health data..." />;
  }

  if (error) {
    return <Card><p className="text-error">{error}</p></Card>;
  }

  if (!health) {
    return null;
  }

  return (
    <Card
      title="Cluster Health"
      headerActions={
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw size={16} />
        </Button>
      }
    >
      <div className="health-stats">
        <div>
          <span>Status:</span>
          <Badge variant={health.status === 'healthy' ? 'success' : 'error'}>
            {health.status}
          </Badge>
        </div>
        <div>
          <span>CPU:</span>
          <span>{health.cpuUsage}%</span>
        </div>
        <div>
          <span>Memory:</span>
          <span>{health.memoryUsage}%</span>
        </div>
      </div>
    </Card>
  );
}
```

---

### 6. Integrate into Page

**File**: `src/pages/ClusterDetails.tsx`

```typescript
import { ClusterHealthCard } from '../components/cluster/ClusterHealthCard';

export function ClusterDetails() {
  const { name } = useParams<{ name: string }>();

  return (
    <div className="cluster-details">
      {/* Existing content */}

      {/* Add health card */}
      <ClusterHealthCard clusterName={name!} />
    </div>
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
