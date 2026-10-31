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
│   ├── app.fixture.ts            # Shared Electron launch fixture (app + window)
│   └── plugins/escape-probe/     # Unsigned plugin that tries to escape the sandbox
├── features/
│   ├── navigation.spec.ts        # Sidebar navigation, theme toggle, window guards
│   ├── first-run.spec.ts         # Empty kubeconfig, unreachable context, kubectl missing
│   ├── cluster-lifecycle.spec.ts # Create and delete a cluster end-to-end
│   ├── cluster-details.spec.ts   # Cluster details UI: tabs, sorting, filters, logs, settings
│   ├── manifests.spec.ts         # Manifest library: create, edit, templates, folders
│   ├── plugins.spec.ts           # Bundled plugins: list, enable/disable, plugin page
│   ├── terminal.spec.ts          # Local shell sessions, Ctrl+C on a running command
│   ├── sandbox-theme.spec.ts     # Host theme toggles while a plugin frame is mounted
│   ├── sandbox-widget.spec.ts    # Plugin dashboard widget + page frame stability
│   └── sandbox-escape.spec.ts    # A hostile plugin cannot leave its frame
├── screenshots/
│   ├── capture.spec.ts           # README and landing page screenshots (not auto-run)
│   └── demo-workload.yaml        # Demo namespace shown in the screenshots
├── screenshots.config.ts         # Playwright config for `npm run screenshots`
├── explore.config.ts             # Playwright config for `npm run test:e2e:interactive`
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

A special interactive test that opens the app and pauses execution. Intended for manual exploration with the Playwright Inspector — not included in the automated `test:e2e` run. The main config ignores it, so `npm run test:e2e:interactive` runs it through `e2e/explore.config.ts`.

---

## Prerequisites

| Requirement | Notes                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kubectl`   | Must be in PATH                                                                                                                                                                 |
| `kind`      | Used as the cluster provider in tests                                                                                                                                           |
| Built app   | `npm run build:react && npm run build:electron` (done automatically by the scripts)                                                                                             |
| Electron    | Since Electron 42 the binary is not downloaded on install. Run `npx install-electron` once for the dev-build mode (the CI smoke job runs the packaged app and does not need it) |

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
`APPIMAGE_EXTRACT_AND_RUN=1` (no libfuse2 on the runners) and runs every
spec. The Windows smoke job lists the specs it runs (`build.yml`) and leaves
out `cluster-lifecycle` and `cluster-details`: the runner cannot run Linux
containers for kind. It installs `kubectl` (setup-kubectl) for the first-run
spec.

### Screenshots

`npm run screenshots` regenerates `docs/images/*.png` (Dashboard, cluster
details, Manifests and Plugins, light and dark, 1280×720 logical pixels). The landing page uses WebP copies of the same files. It is not part
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

### README demo GIF

`npm run demo-gif` records a short tour of the app (`e2e/screenshots/demo.spec.ts`)
and turns it into `docs/images/demo.gif` (`scripts/demo-gif.js`). The tour
starts on the Dashboard, creates a kind cluster called `demo`, opens the logs
of a pod of the demo workload, applies the Deployment example from the
Manifests page and runs `kubectl get pods -A` in the terminal; the wait for
kind is left out. Playwright cannot record a video of an Electron window, so
the spec takes 1280×800 screenshots back to back (light theme, about ten per
second) only while a take runs (the waits for kubectl, for the pod logs and
for the apply result are left out, so the length does not depend on the
machine), and lists them with their real durations in
`test-results/demo/frames.txt` for ffmpeg's concat demuxer; the script joins
them (ffmpeg must be on the PATH) and encodes a palette-optimised GIF, trying
smaller widths and frame rates until it is under 5 MB.

Same setup as the screenshots (packaged build in `SHOAL_E2E_EXECUTABLE`, the
`shoal-demo` cluster with the demo workload, a `KUBECONFIG` that only holds
it) plus a running Docker, because the tour creates a second kind cluster; the
spec deletes that cluster when it finishes. The app runs with a neutral home
directory (`C:\Users\Public` on Windows, `/tmp/shoal-demo` on Linux) so the
terminal prompt shows no user name. The frames stay in
`test-results/demo/` for a re-run of the script alone
(`node scripts/demo-gif.js [frames.txt] [output.gif]`). Watch the GIF before
committing it, for the same reasons as the screenshots.

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

Creates a cluster once (`beforeAll`), runs 11 UI tests against its details page, then deletes it (`afterAll`).

| Test               | What is verified                                             |
| ------------------ | ------------------------------------------------------------ |
| Header             | Cluster name shown (handles `kind-` prefix)                  |
| Default tab        | Pods tab is active on entry                                  |
| Tab switching      | Clicks through Deployments, Services, ConfigMaps, Pods       |
| Namespace selector | Switches to `kube-system`, verifies pods load, switches back |
| Sort by Name       | Column header click cycles asc → desc, sort icon visible     |
| Sort by Namespace  | Sort icon appears on different column                        |
| Row hover actions  | Describe, YAML, Logs buttons appear on row hover             |
| Log viewer Follow  | Streams a CoreDNS pod live, pauses on scroll, reconnects     |
| Settings filter    | Typing in search narrows the resource list                   |
| Settings toggle    | Jobs toggle switch changes CSS class (on → off → on)         |
| Settings columns   | Column section title matches the active tab name             |

### `navigation.spec.ts`

Walks the sidebar, toggles the theme, and checks the main window's guards:
a page script that calls `window.open` or sets `location.href` to an
outside URL changes nothing (the main process denies new windows and
navigation away from the app). No cluster needed.

### `first-run.spec.ts`

Two launches with their own `KUBECONFIG`, no cluster needed; it runs on both
smoke runners. With a
kubeconfig that holds no context, the Dashboard and the cluster list say
where contexts come from and no error toast appears. With a context whose
server is an address that never answers (TEST-NET-3), the window must open
in under 20 seconds (the bundled Namespace Watcher runs kubectl while it
activates, and start-up used to wait for it) and the cluster details page
must settle on its error panel instead of alternating with the spinner on
every auto-refresh.

A third launch has no kubectl at all. The spec does not touch the machine:
every PATH folder that holds a kubectl is replaced by a folder of symlinks
to everything else in it, so the main process meets the genuine "not
installed or not on the PATH" error while its child processes keep every
other tool. The Dashboard and the cluster list must show the **kubectl not
found** notice with its install link and **Check again** button and no
error toast; then the binary is linked back into the first mirror folder
and **Check again** must clear the notice without a restart. The group runs
on Linux and macOS only (on Windows the main process re-reads the registry
PATH before each probe and finds the installed kubectl again), skips the
last step on a machine without kubectl, and skips entirely when kubectl
lives in a folder Shoal appends to the PATH by itself
(`electron/utils/path-env.ts`), because that one cannot be hidden.

### `plugins.spec.ts`

Bundled plugins on a fresh user data directory, no cluster needed: the
installed list shows the example plugins, Resource Monitor can be disabled
and enabled again from its card (the state badge and its **Pod Monitor**
sidebar entry follow), and its page mounts the sandboxed frame with the
plugin running inside.

Start-up activates the bundled plugins in the background after the window
opens, so the round-trip test first waits for the badge to read Enabled
instead of racing that activation with a click. It locates the Enable and
Disable buttons by their exact label: a single toggle locator that matched
both labels was re-resolved by Playwright when a retry followed a state
change, and the test pressed Disable when it meant Enable. The plugin list
itself no longer swaps to a spinner on every refresh (a click that landed
while the cards were being remounted used to be lost), which is what made
the test flaky against packaged builds.

### `terminal.spec.ts`

Local shell only, no cluster. Starts a session, checks the shell picker,
round-trips an `echo` through the real shell, and interrupts a running
command: it starts a child process that would hold the shell for a minute
(`ping -n 60 127.0.0.1` on Windows, `sleep 60` on Linux), presses Ctrl+C
and expects a following `echo` to answer within 20 seconds. Sessions have
no PTY, so this proves the interrupt reaches the child itself (`taskkill /T`
per child on Windows, `pkill -INT -P` on Linux) and not only the shell. The
spec was what revealed that the Windows interrupt had never killed anything
(it matched processes by name). The last test
checks that **New Terminal** starts a session without the old scrollback.

### `sandbox-theme.spec.ts`

Toggles dark/light mode while a plugin dashboard widget is mounted and asserts that the host document's `data-theme` changes and the frame stays mounted. The frame itself mirrors the theme through the `host:theme` event, which the unit tests cover (the frame document is opaque-origin, so the spec reads only the host). Does not need a cluster.

### `sandbox-widget.spec.ts`

Covers the sandboxed plugin UI surfaces (no cluster needed):

- A plugin dashboard widget renders inside its iframe and stays stable (no iframe remount thrash).
- A plugin page frame is height-bounded so long plugin pages scroll inside the frame instead of growing the app layout.

### `sandbox-escape.spec.ts`

The sandbox under a hostile plugin (no cluster needed). Before launch, the
spec copies `e2e/fixtures/plugins/escape-probe` into the user data
directory as a user-installed plugin. The plugin declares no permissions;
its page tries to reach the host DOM, navigate the top window, open a
popup, use `fetch`, XHR and WebSocket, read the clipboard, find Node
globals and call the bridge beyond its permissions (`k8sPlugin` and the
legacy `window.electron` shim). It prints one `name=outcome` line per probe
inside the frame; the spec reads them through `frameLocator` and expects
every one to be `blocked`, the CSP to have reported `connect-src`
violations and the host window to be the only window. A last test asks the
frame, from outside, to navigate itself to an outside URL: the host
document's CSP (`frame-src`) refuses it (the frame shows an error page,
nothing from outside loads) and the host stays where it was.

Against a packaged build (`SHOAL_E2E_EXECUTABLE`) unsigned plugins never
load, so the spec checks that instead: the bundled plugins are listed and
the fixture's card is in the error state with the message that the plugin
is not signed.

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
