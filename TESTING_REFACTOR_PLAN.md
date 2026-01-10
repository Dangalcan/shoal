# Testing Infrastructure Refactor

Analyze and refactor the project's testing infrastructure to improve maintainability, reduce redundancy, and ensure long-term health.

## User Review Required

> [!IMPORTANT]
> This refactor will move many inline mocks and data structures to shared files in `src/test/`. While it won't change application functionality, it will change how tests are written and organized.

## Proposed Changes

### Test Fixtures

Extract static mock data to shared files to reduce bloat in test files.

#### [NEW] [k8s-resources.ts](file:///c:/Users/pc/Desktop/uni3/Kubernetes%20Desktop/src/test/fixtures/k8s-resources.ts)

- Define reusable mock objects for Pods, Deployments, Nodes, etc.
- Use strong types from [k8s-types.ts](file:///c:/Users/pc/Desktop/uni3/Kubernetes%20Desktop/src/types/k8s-types.ts).

### Test Utilities & Mocks

Centralize common testing patterns and component mocks.

#### [NEW] [test-utils.tsx](file:///c:/Users/pc/Desktop/uni3/Kubernetes%20Desktop/src/test/test-utils.tsx)

- Create a custom `render` function that includes `MemoryRouter` and other shared providers.
- Add helper functions for common UI interactions (e.g., `waitForLoadingToFinish`).

#### [NEW] [component-mocks.tsx](file:///c:/Users/pc/Desktop/uni3/Kubernetes%20Desktop/src/test/mocks/component-mocks.tsx)

- Move repeatable mocks for `DescribeModal`, `LogViewerModal`, etc. to a shared location.

#### [MODIFY] [setup.ts](file:///c:/Users/pc/Desktop/uni3/Kubernetes%20Desktop/src/test/setup.ts)

- Clean up global mocks and possibly integrate shared component mocks.

### Test File Refactoring

Apply the new fixtures and utilities to existing tests.

#### [MODIFY] [ClusterDetails.test.tsx](file:///c:/Users/pc/Desktop/uni3/Kubernetes%20Desktop/src/pages/__tests__/ClusterDetails.test.tsx)

- Replace inline mock data with imported fixtures.
- Use shared component mocks.
- Simplify rendering using `test-utils`.

#### [MODIFY] [LogViewerModal.test.tsx](file:///c:/Users/pc/Desktop/uni3/Kubernetes%20Desktop/src/components/__tests__/LogViewerModal.test.tsx)

- Enrich test cases to better cover async behavior and error states.

## Verification Plan

### Automated Tests

- Run `npm test` to ensure all tests still pass after refactoring.
- Run `npm run test:coverage` to verify that coverage remains high.

### Manual Verification

- Review the simplified test code for readability and maintainability.
