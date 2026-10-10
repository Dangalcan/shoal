# E2E Testing Guide

End-to-end tests for Shoal use [Playwright](https://playwright.dev/) with its native Electron support. Tests run against a real built app, a real `kubectl` CLI, and a real local Kubernetes cluster — no mocks.

The same specs run in two modes:

- **Dev build** (default): the app compiled in this repo (`dist-electron/main.js`).
- **Packaged app**: set `SHOAL_E2E_EXECUTABLE` to an installed or packaged
  executable (`Shoal.exe`, the AppImage, `release/win-unpacked/Shoal.exe`).
  Packaged builds only load signed plugins, exactly as for users. CI uses this
  mode as the installer smoke test (`smoke` job in `.github/workflows/build.yml`).

---

## Folder Structure

```
e2e/
├── fixtures/
│   ├── launch.ts                 # launchApp() + mainWindow(): dev build or packaged app
│   └── app.fixture.ts            # Shared Electron launch fixture (app + window)
├── features/
│   ├── navigation.spec.ts        # Sidebar navigation and theme toggle
│   ├── cluster-lifecycle.spec.ts # Create and delete a cluster end-to-end
│   ├── cluster-details.spec.ts   # Cluster details UI: tabs, sorting, filters, settings
│   ├── manifests.spec.ts         # Manifest library: create, edit, templates, folders
│   ├── plugins.spec.ts           # Bundled plugins: list, enable/disable, plugin page
│   ├── terminal.spec.ts          # Local shell sessions
│   ├── sandbox-theme.spec.ts     # Plugin iframe follows host theme toggles
│   └── sandbox-widget.spec.ts    # Plugin dashboard widget + page frame stability
├── screenshots/
│   ├── capture.spec.ts           # README and landing page screenshots (not auto-run)
│   └── demo-workload.yaml        # Demo namespace shown in the screenshots
├── screenshots.config.ts         # Playwright config for `npm run screenshots`
└── explore.spec.ts               # Interactive exploration tool (not auto-run)
```

### `fixtures/`

Contains shared test setup. Always launch the app through `launch.ts`:

- **`launchApp({ userDataDir? })`** starts the dev build, or the executable in
  `SHOAL_E2E_EXECUTABLE`. Every launch gets a fresh temporary user data
  directory unless one is passed, so each test starts from a clean first run
  (bundled example plugins enabled, empty databases). On Linux the packaged app
  gets `--no-sandbox` (Ubuntu 24.04 blocks Chromium's sandbox in CI).
- **`mainWindow(app)`** returns the main window once the app shell
  (`aside.sidebar`) is visible. Do not stop at `domcontentloaded`: the window
  commits a second navigation right after the first load, and a
  `page.evaluate` issued in between fails with "Execution context was
  destroyed".

`app.fixture.ts` wraps both as two Playwright fixtures:

- **`app`** — a launched `ElectronApplication` instance
- **`window`** — the app's main window as a Playwright `Page`

Tests that use the fixture get a fresh app per test. Tests that need shared state across multiple assertions (like `cluster-details`) manage the `app` and `window` directly with `beforeAll`/`afterAll`.

### `features/`

Each file tests one feature area. Tests within a file run sequentially and share state where needed (e.g. `cluster-details` creates a cluster once in `beforeAll` and deletes it in `afterAll`).

### `explore.spec.ts`

A special interactive test that opens the app and pauses execution. Intended for manual exploration with the Playwright Inspector — not included in the automated `test:e2e` run.

---

## Prerequisites

| Requirement | Notes                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| `kubectl`   | Must be in PATH                                                                                                           |
| `kind`      | Used as the cluster provider in tests                                                                                     |
| Built app   | `npm run build:react && npm run build:electron` (done automatically by the scripts)                                       |
| Electron    | Since Electron 42 the binary is not downloaded on install. Run `npx install-electron` once (CI does it before Playwright) |

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

Against a packaged app instead of the dev build (Git Bash; build it first with
`npx electron-builder --win --dir --publish never`):

```bash
SHOAL_E2E_EXECUTABLE="$PWD/release/win-unpacked/Shoal.exe" npx playwright test
```

On Linux CI the AppImage runs under `xvfb-run -a` with
`APPIMAGE_EXTRACT_AND_RUN=1` (no libfuse2 on the runners). The Windows smoke
job skips the two cluster specs because the runner cannot run Linux containers.

### Screenshots

`npm run screenshots` regenerates `docs/images/*.png` (Dashboard, Clusters,
cluster details, Manifests and Plugins, light and dark, 1280×720 logical
pixels). The landing page uses WebP copies of the same files. It is not part
of `test:e2e` and needs some setup so the images show exactly what users get
and nothing from your own machine (Git Bash):

```bash
# 1. Packaged build: a dev run also lists every plugin checked out under plugins/.
#    Stop Docker Desktop while packaging if memory is tight.
npm run build:react && npm run build:electron
npx electron-builder --win --dir --publish never

# 2. A kubeconfig that only holds the demo cluster, so no other context shows up.
export KUBECONFIG="$(mktemp)"
kind create cluster --name shoal-demo
kubectl apply -f e2e/screenshots/demo-workload.yaml
kubectl -n demo rollout status deploy/web

# 3. Capture, then clean up.
SHOAL_E2E_EXECUTABLE="$PWD/release/win-unpacked/Shoal.exe" npm run screenshots
kind delete cluster --name shoal-demo
```

Check every image by hand before committing: no personal contexts, paths or
hostnames.

---

## Configuration

**`playwright.config.ts`** at the project root:

```ts
{
  testDir: './e2e',
  testIgnore: ['**/explore.spec.ts', '**/screenshots/**'], // excluded from automated runs
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

### `sandbox-theme.spec.ts`

Verifies that a mounted plugin iframe follows the host app's theme: toggles dark/light mode while a plugin frame is open and asserts the frame's `data-theme` updates. Does not need a cluster.

### `sandbox-widget.spec.ts`

Covers the sandboxed plugin UI surfaces (no cluster needed):

- A plugin dashboard widget renders inside its iframe and stays stable (no iframe remount thrash).
- A plugin page frame is height-bounded so long plugin pages scroll inside the frame instead of growing the app layout.

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
