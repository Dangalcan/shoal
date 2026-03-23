# Contributing: Writing Tests 🧪

This guide explains how to write effective tests for the Kubernetes Desktop application. We use **Vitest** for unit/integration tests and **Playwright** for E2E testing.

---

## Testing Philosophy

We follow these principles:

1. **Test behavior, not implementation** - Focus on what the code does, not how it's written.
2. **Write tests that give confidence** - Cover critical paths, security logic, and edge cases.
3. **Isolate tests** - Each test should be independent and reset any global state.
4. **Fast feedback** - Unit tests should be near-instant; E2E tests should be focused.

---

## Test Structure

```
src/test/
├── components/        # React component tests
├── hooks/            # Custom hook tests
├── pages/            # Page-level integration tests
├── electron/         # Backend (Main Process) service and IPC tests
├── lib/              # Utility logic tests
├── integration/      # Multi-component flow tests
├── fixtures/         # Test data and builders
└── utils/            # Test infrastructure
    ├── render.tsx    # Custom render with providers
    └── mocks.ts      # createMockElectronAPI utility

e2e/                  # Playwright End-to-End tests
```

---

## Writing Component & Hook Tests

Use the custom `render` utility from `src/test/utils/render.tsx`. It automatically wraps your component in `ApiProvider`, `ClusterProvider`, and `MemoryRouter`.

### 1. Basic Component Test

```typescript
import { render, screen } from '../utils';
import { Button } from '../../components/ui/Button';

it('should render children and handle clicks', async () => {
  const handleClick = vi.fn();
  render(<Button onClick={handleClick}>Click Me</Button>);

  const button = screen.getByRole('button', { name: /click me/i });
  await fireEvent.click(button);

  expect(handleClick).toHaveBeenCalled();
});
```

### 2. Testing with API Mocks

Use `createMockElectronAPI` to mock Electron IPC calls.

```typescript
import { render, screen, waitFor } from '../utils';
import { createMockElectronAPI } from '../utils/mocks';
import { ClusterDetails } from '../../pages/ClusterDetails';

it('should display cluster data from API', async () => {
  const mockApi = createMockElectronAPI({
    getNamespaces: vi.fn().mockResolvedValue({ success: true, data: ['default'] }),
  });

  render(<ClusterDetails />, { api: mockApi });

  await waitFor(() => {
    expect(screen.getByText('default')).toBeInTheDocument();
  });
});
```

---

## Testing Terminal Features

When testing components that interact with the Terminal API, you must mock the session lifecycle.

```typescript
it('should initialize terminal session', async () => {
  const mockApi = createMockElectronAPI({
    terminalCreate: vi.fn().mockResolvedValue({ success: true, data: 'session-123' }),
  });

  render(<PodTerminal podName="test-pod" />, { api: mockApi });

  await waitFor(() => {
    expect(mockApi.terminalCreate).toHaveBeenCalledWith(expect.objectContaining({
      podName: 'test-pod'
    }));
  });
});
```

---

## E2E Testing (Playwright)

End-to-End tests run the **real production build** of the Electron app.

### 1. Test Location

E2E tests live in the `e2e/` directory and use the `.spec.ts` extension.

### 2. Using the App Fixture

Use the standard fixture from `e2e/fixtures/app.fixture.ts` to get access to the `window` (Page object).

```typescript
import { test, expect } from './fixtures/app.fixture';

test('create and delete a manifest', async ({ window }) => {
  await window.click('text=Manifests');
  await window.fill('placeholder=Manifest Name', 'test-manifest');
  await window.click('button:has-text("Save")');

  await expect(window.locator('text=test-manifest')).toBeVisible();
});
```

### 3. Interactive Debugging

Use the explore test to pick locators interactively:

```bash
npm run test:e2e:interactive
```

---

## Coverage Requirements

We maintain high standards for core logic:

- **Lines**: 85%
- **Functions**: 80%
- **Branches**: 70%

Run coverage report:

```bash
npm run test:coverage
```

---

## Best Practices

### ✅ DO

- **Use `screen.getByRole`**: It's the most robust way to query elements.
- **Mock the entire `Result<T>` pattern**: Ensure your mocks return `{ success: true, data: ... }`.
- **Reset mocks**: Use `beforeEach(() => vi.clearAllMocks())` or `resetAllMocks()` from `utils/mocks.ts`.

### ❌ DON'T

- **Don't ignore the Electron bridge**: Always use `useApi()` in your components so they can be mocked in Vitest.
- **Don't use `wait(1000)`**: Use `waitFor()` from React Testing Library or `window.waitForSelector()` in Playwright.

---

## Commands Summary

| Command                        | Description                    |
| ------------------------------ | ------------------------------ |
| `npm run test`                 | Run all Vitest tests           |
| `npm run test:ui`              | Open Vitest UI (interactive)   |
| `npm run test:coverage`        | Generate coverage report       |
| `npm run test:e2e`             | Run Playwright E2E tests       |
| `npm run test:e2e:interactive` | Explore locators interactively |
