# Contributing: Writing Tests 🧪

This guide explains how to write effective tests for the Kubernetes Desktop application.

---

## Testing Philosophy

We follow these principles:

1. **Test behavior, not implementation** - Focus on what the code does, not how
2. **Write tests that give confidence** - Cover critical paths and edge cases
3. **Keep tests maintainable** - Clear, concise, and easy to understand
4. **Fast feedback** - Tests should run quickly

---

## Test Structure

```
src/test/
├── components/        # Component tests
├── hooks/            # Hook tests
├── pages/            # Page tests
├── integration/      # Integration tests
├── fixtures/         # Test data
├── helpers/          # Test utilities
└── utils/            # Centralized test utilities
    ├── index.ts      # Main export
    ├── render.tsx    # Custom render with providers
    ├── mocks.ts      # Mock Electron API
    └── assertions.ts # Custom assertions
```

---

## Writing Component Tests

### Basic Component Test

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '../utils';
import { MyComponent } from '../../components/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent title="Test" />);

    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);

    await fireEvent.click(screen.getByRole('button', { name: /click me/i }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Testing with API Mocks

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '../utils';
import { createMockElectronAPI } from '../utils/mocks';
import { ClusterList } from '../../components/ClusterList';

describe('ClusterList', () => {
  it('should display clusters from API', async () => {
    const mockApi = createMockElectronAPI({
      getClusters: vi.fn().mockResolvedValue({
        success: true,
        data: ['cluster-1', 'cluster-2'],
      }),
    });

    render(<ClusterList />, { api: mockApi });

    await waitFor(() => {
      expect(screen.getByText('cluster-1')).toBeInTheDocument();
      expect(screen.getByText('cluster-2')).toBeInTheDocument();
    });
  });

  it('should handle API errors', async () => {
    const mockApi = createMockElectronAPI({
      getClusters: vi.fn().mockResolvedValue({
        success: false,
        error: 'Network error',
      }),
    });

    render(<ClusterList />, { api: mockApi });

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});
```

---

## Writing Hook Tests

### Basic Hook Test

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ApiProvider } from '../../services/api-context';
import { createMockElectronAPI } from '../utils/mocks';
import { useClusters } from '../../hooks/useClusters';

describe('useClusters', () => {
  it('should fetch clusters on mount', async () => {
    const mockApi = createMockElectronAPI({
      getClusters: vi.fn().mockResolvedValue({
        success: true,
        data: ['cluster-1'],
      }),
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ApiProvider api={mockApi}>{children}</ApiProvider>
    );

    const { result } = renderHook(() => useClusters(), { wrapper });

    await waitFor(() => {
      expect(result.current.clusters).toEqual(['cluster-1']);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle delete cluster', async () => {
    const mockApi = createMockElectronAPI({
      getClusters: vi.fn().mockResolvedValue({
        success: true,
        data: ['cluster-1'],
      }),
      deleteCluster: vi.fn().mockResolvedValue({
        success: true,
      }),
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ApiProvider api={mockApi}>{children}</ApiProvider>
    );

    const { result } = renderHook(() => useClusters(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.deleteCluster('cluster-1');

    expect(mockApi.deleteCluster).toHaveBeenCalledWith('cluster-1');
  });
});
```

---

## Writing Page Tests

### Testing Pages with Routing

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '../utils';
import { createMockElectronAPI } from '../utils/mocks';
import { ClusterDetails } from '../../pages/ClusterDetails';

describe('ClusterDetails Page', () => {
  it('should display cluster resources', async () => {
    const mockApi = createMockElectronAPI({
      getNamespaces: vi.fn().mockResolvedValue({
        success: true,
        data: ['default', 'kube-system'],
      }),
      getResources: vi.fn().mockResolvedValue({
        success: true,
        data: [
          { metadata: { name: 'pod-1' }, status: { phase: 'Running' } },
        ],
      }),
    });

    render(<ClusterDetails />, {
      api: mockApi,
      path: '/cluster/:name',
      route: '/cluster/test-cluster',
    });

    await waitFor(() => {
      expect(screen.getByText('pod-1')).toBeInTheDocument();
    });
  });
});
```

---

## Integration Tests

### Testing User Flows

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '../utils';
import { createMockElectronAPI } from '../utils/mocks';
import { App } from '../../App';

describe('Cluster Creation Flow', () => {
  it('should create cluster and navigate to list', async () => {
    const mockApi = createMockElectronAPI({
      createCluster: vi.fn().mockResolvedValue({ success: true }),
      getClusters: vi.fn().mockResolvedValue({
        success: true,
        data: ['new-cluster'],
      }),
    });

    render(<App />, { api: mockApi });

    // Navigate to create page
    fireEvent.click(screen.getByText(/create new cluster/i));

    // Fill form
    const nameInput = screen.getByPlaceholderText('my-cluster');
    fireEvent.change(nameInput, { target: { value: 'new-cluster' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /create cluster/i }));

    // Verify navigation and cluster appears
    await waitFor(() => {
      expect(screen.getByText('new-cluster')).toBeInTheDocument();
    });
  });
});
```

---

## Common Testing Patterns

### Pattern 1: Testing Loading States

```typescript
it('should show loading spinner', () => {
  const mockApi = createMockElectronAPI({
    getClusters: vi.fn().mockImplementation(
      () => new Promise(() => {}) // Never resolves
    ),
  });

  render(<ClusterList />, { api: mockApi });

  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});
```

### Pattern 2: Testing Error States

```typescript
it('should display error message', async () => {
  const mockApi = createMockElectronAPI({
    getClusters: vi.fn().mockRejectedValue(new Error('Failed to fetch')),
  });

  render(<ClusterList />, { api: mockApi });

  await waitFor(() => {
    expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument();
  });
});
```

### Pattern 3: Testing User Interactions

```typescript
it('should handle form submission', async () => {
  const handleSubmit = vi.fn();
  render(<MyForm onSubmit={handleSubmit} />);

  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'test-name' } });
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));

  expect(handleSubmit).toHaveBeenCalledWith({ name: 'test-name' });
});
```

### Pattern 4: Testing Async Operations

```typescript
it('should handle async data fetching', async () => {
  const mockApi = createMockElectronAPI({
    getData: vi.fn().mockResolvedValue({
      success: true,
      data: { value: 'test' },
    }),
  });

  render(<MyComponent />, { api: mockApi });

  // Wait for async operation
  await waitFor(() => {
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  expect(mockApi.getData).toHaveBeenCalledTimes(1);
});
```

---

## Best Practices

### ✅ DO

- **Use `screen` queries** for better error messages

  ```typescript
  // ✅ Good
  expect(screen.getByText('Hello')).toBeInTheDocument();

  // ❌ Bad
  const { getByText } = render(<Component />);
  expect(getByText('Hello')).toBeInTheDocument();
  ```

- **Use `waitFor` for async assertions**

  ```typescript
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });
  ```

- **Use semantic queries**

  ```typescript
  screen.getByRole('button', { name: /submit/i });
  screen.getByLabelText('Email');
  screen.getByPlaceholderText('Enter name');
  ```

- **Test accessibility**
  ```typescript
  expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Close');
  ```

### ❌ DON'T

- **Don't test implementation details**

  ```typescript
  // ❌ Bad
  expect(component.state.count).toBe(1);

  // ✅ Good
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
  ```

- **Don't use `container.querySelector`**

  ```typescript
  // ❌ Bad
  const button = container.querySelector('.my-button');

  // ✅ Good
  const button = screen.getByRole('button');
  ```

- **Don't forget to clean up**
  ```typescript
  // ✅ Good - cleanup happens automatically with render()
  ```

---

## Coverage Requirements

Maintain these minimum coverage thresholds:

- **Lines**: 85%
- **Statements**: 85%
- **Functions**: 80%
- **Branches**: 70%

Run coverage report:

```bash
npm run test:coverage
```

---

## Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test src/test/components/MyComponent.test.tsx
```

---

## Debugging Tests

### Using `screen.debug()`

```typescript
it('should render', () => {
  render(<MyComponent />);
  screen.debug(); // Prints DOM to console
});
```

### Using `logRoles()`

```typescript
import { logRoles } from '@testing-library/react';

it('should have accessible roles', () => {
  const { container } = render(<MyComponent />);
  logRoles(container); // Shows all accessible roles
});
```

---

## Next Steps

1. ✅ Read [Feature Development Guide](./CONTRIBUTING_FEATURES.md)
2. ✅ Read [Styling Guide](./CONTRIBUTING_STYLES.md)
3. 💡 **Pro-tip**: If a test file uses JSX in its setup (e.g., in a wrapper), ensure the extension is `.tsx`.
4. 💡 **Pro-tip**: When mocking functions with `(mockApi.method as any).mock...`, prefix the line with a semicolon `;` if it follows a line ending in `]` or `}` to avoid expression grouping errors.
5. ✅ Check existing tests for examples
6. ✅ Run tests before committing: `npm run test`
