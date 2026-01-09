# Testing Guide

This document provides comprehensive information about the test suite for the Kubernetes Desktop application.

## Overview

The test suite uses **Vitest** as the testing framework and **React Testing Library** for component testing. All tests are designed to run without requiring an actual Kubernetes cluster, using mocked Electron IPC calls.

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm test -- --watch
```

### Run tests with UI
```bash
npm run test:ui
```
This opens an interactive UI in your browser where you can see test results, filter tests, and view coverage.

### Generate coverage report
```bash
npm run test:coverage
```
Coverage reports are generated in the `coverage/` directory. Open `coverage/index.html` in a browser to view detailed coverage information.

## Test Structure

```
src/
├── lib/
│   └── __tests__/
│       └── utils.test.ts          # Utility function tests
├── components/
│   └── __tests__/
│       ├── DescribeModal.test.tsx
│       ├── LogViewerModal.test.tsx
│       ├── PodViewerModal.test.tsx
│       └── YamlModal.test.tsx
├── pages/
│   └── __tests__/
│       ├── Clusters.test.tsx
│       ├── ClusterDetails.test.tsx
│       ├── CreateCluster.test.tsx
│       └── Dashboard.test.tsx
└── test/
    └── setup.ts                   # Test setup and mocks

electron/
└── __tests__/
    └── main.test.ts               # Electron IPC handler tests
```

## Test Coverage Goals

- **Utility Functions**: 80%+ coverage
- **Components**: 70%+ coverage
- **Pages**: 70%+ coverage
- **Electron IPC Handlers**: 80%+ coverage

## Writing New Tests

### Component Tests

When testing React components:

1. **Import necessary utilities**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
```

2. **Mock Electron API** (already available globally):
```typescript
import { mockElectronAPI } from '../../test/setup'

// In your test
mockElectronAPI.getClusters.mockResolvedValue(['cluster-1'])
```

3. **Wrap components requiring routing**:
```typescript
import { BrowserRouter } from 'react-router-dom'

const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

render(<YourComponent />, { wrapper: RouterWrapper })
```

4. **Test user interactions**:
```typescript
const user = userEvent.setup()
const button = screen.getByRole('button', { name: /click me/i })
await user.click(button)
```

### Electron IPC Tests

Electron IPC handlers are tested by mocking the `child_process` module:

```typescript
import { vi } from 'vitest'
import { exec } from 'child_process'

vi.mock('child_process', () => ({
  exec: vi.fn(),
}))

// In your test
const mockExec = exec as unknown as ReturnType<typeof vi.fn>
mockExec.mockImplementation((cmd, callback) => {
  callback(null, { stdout: 'success', stderr: '' })
})
```

## Best Practices

### 1. Clear Mocks Between Tests
```typescript
beforeEach(() => {
  vi.clearAllMocks()
})
```

### 2. Test User Behavior, Not Implementation
Focus on what the user sees and does, not internal component state:
```typescript
// Good
expect(screen.getByText('Success!')).toBeInTheDocument()

// Avoid
expect(component.state.success).toBe(true)
```

### 3. Use Semantic Queries
Prefer queries that reflect how users interact with your app:
```typescript
// Good
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText('Email')

// Less preferred
screen.getByTestId('submit-button')
```

### 4. Wait for Async Operations
```typescript
await waitFor(() => {
  expect(screen.getByText('Data loaded')).toBeInTheDocument()
})
```

### 5. Mock External Dependencies
All Electron API calls are automatically mocked via `src/test/setup.ts`. Configure mock responses in your tests:
```typescript
mockElectronAPI.getPods.mockResolvedValue({
  success: true,
  pods: [/* mock data */],
})
```

## Troubleshooting

### Tests Fail with "window.electron is undefined"
The Electron API is mocked in `src/test/setup.ts`. Make sure your test imports are correct and the setup file is loaded (configured in `vitest.config.ts`).

### Tests Timeout
Increase the timeout for specific tests:
```typescript
it('slow test', async () => {
  // test code
}, 10000) // 10 second timeout
```

### Coverage Not Generated
Install the coverage provider:
```bash
npm install -D @vitest/coverage-v8
```

### Router-Related Errors
Components using `useNavigate`, `useParams`, etc. must be wrapped with `BrowserRouter`:
```typescript
render(<Component />, { wrapper: RouterWrapper })
```

## CI/CD Integration

Tests are designed to run in CI environments without requiring:
- Kubernetes cluster
- kubectl binary
- Docker
- Any external services

Simply run `npm test` in your CI pipeline. Tests complete in under 30 seconds for fast feedback.

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
