# Contributing: Writing Tests 🧪

This guide explains how to write effective tests for the Shoal application. We use **Vitest** for unit/integration tests and **Playwright** for E2E testing.

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
├── features/         # Feature hook and component tests
├── lib/              # Utility logic tests
├── integration/      # Multi-component flow tests
├── fixtures/         # Test data and builders
├── mocks/            # Shared module mocks (toast, ...)
└── utils/            # Test infrastructure
    ├── render.tsx    # Custom render with providers
    └── mocks.ts      # createMockElectronAPI utility

electron/__tests__/   # Main-process service and IPC tests (node environment)

e2e/                  # Playwright End-to-End tests
```

---

## Writing Component & Hook Tests

Use the custom `render` utility from `src/test/utils/render.tsx`. It automatically wraps your component in `ApiProvider`, `ClusterProvider`, and `MemoryRouter`.

### 1. Basic Component Test

```typescript
import { render, screen, fireEvent } from '../utils';
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
it('should open a local shell session', async () => {
  const mockApi = createMockElectronAPI({
    terminalCreate: vi.fn().mockResolvedValue({
      success: true,
      data: { sessionId: 'session-123', shellFamily: 'unix' },
    }),
  });

  render(<TerminalPage />, { api: mockApi });

  await waitFor(() => {
    expect(mockApi.terminalCreate).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'local' })
    );
  });
});
```

The default mock already resolves `terminalCreate`, `onTerminalOutput` and
`onTerminalExited`; override them only to drive a specific flow.

---

## E2E Testing (Playwright)

End-to-End tests run the **compiled app** (`dist/` and `dist-electron/`), or a
packaged executable when `SHOAL_E2E_EXECUTABLE` is set (see
[E2E-TESTS.md](E2E-TESTS.md)).

### 1. Test Location

E2E tests live in `e2e/features/` and use the `.spec.ts` extension.

### 2. Using the App Fixture

Use the standard fixture from `e2e/fixtures/app.fixture.ts` to get access to the `window` (Page object).

```typescript
import { test, expect } from '../fixtures/app.fixture';

test('create a manifest', async ({ window }) => {
  await window.getByRole('link', { name: 'Manifests' }).click();
  await window.getByRole('button', { name: 'New Manifest' }).click();
  await window.getByPlaceholder('e.g., Nginx Deployment').fill('test-manifest');
  await window.getByRole('button', { name: 'Save' }).click();

  await expect(window.getByText('test-manifest')).toBeVisible();
});
```

### 3. Interactive Debugging

Use the explore test to pick locators interactively:

```bash
npm run test:e2e:interactive
```

---

## Coverage Requirements

We maintain high standards for core logic. The thresholds live in
`vitest.config.ts`, and CI runs `npm run test:coverage`, so a pull request
that drops below any of them fails:

- **Lines**: 90%
- **Statements**: 90%
- **Functions**: 90%
- **Branches**: 80%

Every production file counts (`coverage.include` in `vitest.config.ts` lists
`electron/**` and `src/**`), so a new page or IPC handler with no test drags
the totals down from the moment it exists, not only once another test loads
it. The process entry points (`electron/main.ts`, `electron/preload.ts`,
`src/main.tsx`) are excluded; the e2e suite exercises them. Page tests should
click through the actions, not only render the empty state.

Run coverage report:

```bash
npm run test:coverage
```

---

## Type Checking

The test files are type-checked separately from the two production configs:
`tsconfig.test.json` covers `src/test/`, `e2e/` and the Vitest and Playwright
config files with the renderer settings (plus the Vitest, jest-dom and Node
types), and `electron/tsconfig.json` already covers `electron/__tests__/`.
CI runs both, so a test that calls an API which no longer exists fails even
when a mock would have hidden it at run time:

```bash
npm run typecheck:test
```

The test config relaxes only `noUncheckedIndexedAccess` (tests index
`mock.calls` all the time) and allows ES2022 library calls.

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
| `npm run typecheck:test`       | Type-check the test files      |
| `npm run test:e2e`             | Run Playwright E2E tests       |
| `npm run test:e2e:interactive` | Explore locators interactively |
