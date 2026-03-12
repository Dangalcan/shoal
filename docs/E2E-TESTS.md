# E2E Testing Guide

End-to-end tests for Kubernetes Desktop use [Playwright](https://playwright.dev/) with its native Electron support. Tests run against a real built app, a real `kubectl` CLI, and a real local Kubernetes cluster — no mocks.

---

## Folder Structure

```
e2e/
├── fixtures/
│   └── app.fixture.ts            # Shared Electron launch fixture (app + window)
├── features/
│   ├── cluster-lifecycle.spec.ts # Create and delete a cluster end-to-end
│   └── cluster-details.spec.ts   # Cluster details UI: tabs, sorting, filters, settings
└── explore.spec.ts               # Interactive exploration tool (not auto-run)
```

### `fixtures/`

Contains shared test setup. `app.fixture.ts` exposes two Playwright fixtures:

- **`app`** — a launched `ElectronApplication` instance
- **`window`** — the app's first `BrowserWindow` as a Playwright `Page`

Tests that use the fixture get a fresh app per test. Tests that need shared state across multiple assertions (like `cluster-details`) manage the `app` and `window` directly with `beforeAll`/`afterAll`.

### `features/`

Each file tests one feature area. Tests within a file run sequentially and share state where needed (e.g. `cluster-details` creates a cluster once in `beforeAll` and deletes it in `afterAll`).

### `explore.spec.ts`

A special interactive test that opens the app and pauses execution. Intended for manual exploration with the Playwright Inspector — not included in the automated `test:e2e` run.

---

## Prerequisites

| Requirement | Notes                                                                               |
| ----------- | ----------------------------------------------------------------------------------- |
| `kubectl`   | Must be in PATH                                                                     |
| `kind`      | Used as the cluster provider in tests                                               |
| Built app   | `npm run build:react && npm run build:electron` (done automatically by the scripts) |

> Tests **do not** require the Vite dev server. The app loads `dist/index.html` directly.

---

## Running Tests

```bash
# Run all automated E2E tests (builds first)
npm run test:e2e

# Open the app interactively with the Playwright Inspector
npm run test:e2e:interactive

# Open the HTML report from the last run
npm run test:e2e:report
```

---

## Configuration

**`playwright.config.ts`** at the project root:

```ts
{
  testDir: './e2e',
  testIgnore: ['**/explore.spec.ts'],   // excluded from automated runs
  timeout: 120_000,                      // 2 min per test (kubectl calls are slow)
  retries: 0,
  workers: 1,                            // sequential — parallel runs cause kubectl conflicts
  fullyParallel: false,
}
```

Key decisions:

- **`workers: 1`** — multiple Electron instances fighting over the same kubeconfig causes flakiness.
- **`timeout: 120_000`** — kubectl operations (especially cluster creation with `kind`) can take 1–3 minutes.
- **`retries: 0`** — E2E tests should be deterministic. Retrying hides real failures.

---

## Test Overview

### `cluster-lifecycle.spec.ts`

Tests the full create → delete flow using the Clusters page UI.

| Step | Action                                                         |
| ---- | -------------------------------------------------------------- |
| 1    | Navigate to `/clusters` via the sidebar                        |
| 2    | Click **Create Cluster**, fill name and select `kind` provider |
| 3    | Submit and wait up to 3 minutes for `kind` to provision        |
| 4    | Verify the cluster card appears                                |
| 5    | Click the trash icon, confirm the deletion modal               |
| 6    | Verify the cluster card is gone                                |

### `cluster-details.spec.ts`

Creates a cluster once (`beforeAll`), runs 10 UI tests against its details page, then deletes it (`afterAll`).

| Test               | What is verified                                             |
| ------------------ | ------------------------------------------------------------ |
| Header             | Cluster name shown (handles `kind-` prefix)                  |
| Default tab        | Pods tab is active on entry                                  |
| Tab switching      | Clicks through Deployments, Services, ConfigMaps, Pods       |
| Namespace selector | Switches to `kube-system`, verifies pods load, switches back |
| Sort by Name       | Column header click cycles asc → desc, sort icon visible     |
| Sort by Namespace  | Sort icon appears on different column                        |
| Row hover actions  | Describe, YAML, Logs buttons appear on row hover             |
| Settings filter    | Typing in search narrows the resource list                   |
| Settings toggle    | Jobs toggle switch changes CSS class (on → off → on)         |
| Settings columns   | Column section title matches the active tab name             |

---

## Selector Strategy

Prefer selectors in this order:

1. **CSS class** scoped to a parent — `clusterCard.locator('.delete-cluster-button')`
2. **Role + exact name** — `getByRole('columnheader', { name: 'Name', exact: true })`
3. **`filter({ hasText: /regex/ })`** — `locator('.settings-item-button').filter({ hasText: /^Jobs$/ })`
4. **`title` attribute** — `locator('button[title="Display Settings"]')`

Avoid `hasText` with plain strings when the text is a substring of another element's label (e.g. `'Name'` matches `'Namespace'`, `'Jobs'` matches `'CronJobs'`). Use exact-match roles or anchor regexes (`/^Jobs$/`) instead.

---

## Adding New Tests

1. Create a new file under `e2e/features/` named after the feature area.
2. Import the shared fixture if you need a single test: `import { test, expect } from '../fixtures/app.fixture'`
3. For suites that share a cluster, manage `app`/`window` directly with `beforeAll`/`afterAll` (see `cluster-details.spec.ts` as the pattern).
4. Use `npm run test:e2e:interactive` to explore the UI and identify selectors before writing assertions.
