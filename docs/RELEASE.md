# Release Process

How a Shoal release is cut, published and, if needed, rolled back.

The version in `package.json` is the single source of truth. The app shows it
in the sidebar (`v` + `app.getVersion()`) and electron-updater compares against
it. Tags are `v` + that version.

## Versions

| Kind              | Example      | GitHub release           | Who gets it through auto-update                                      |
| ----------------- | ------------ | ------------------------ | -------------------------------------------------------------------- |
| Release candidate | `0.9.0-rc.1` | Published as pre-release | Users on a pre-release, while no stable release exists               |
| Stable            | `0.9.0`      | Published as release     | Everyone, pre-release users included (and the landing page download) |
| Patch             | `0.9.1`      | Published as release     | Everyone                                                             |

The updater asks for the stable channel first (`/releases/latest`); only when
no stable release exists yet and the installed version is a pre-release does
it check again accepting pre-releases. So a release candidate updates to the
next candidate until `0.9.0` is published and to `0.9.0` after that, and a
stable version never receives a pre-release.

The landing page links to `/releases/latest`, which GitHub resolves to the
newest **non** pre-release.

## Cutting a release

1. Make sure `master` is green: CI and gitleaks; Build/Release green once the
   repository is public.
2. On a branch, bump `version` in `package.json` (and the two version fields at
   the top of `package-lock.json`), update `CHANGELOG.md`, open a PR and
   merge it. Release candidates accumulate under the
   `## [Unreleased] - 0.9.0 public beta` heading. For the stable release,
   retitle that heading `## [0.9.0] - 2026-11-02`, add an empty
   `## [Unreleased]` above it and update the compare links at the bottom of
   the file (`[0.9.0]: .../compare/v0.9.0-rc.3...v0.9.0`).
3. Tag the merge commit and push the tag:

   ```bash
   git checkout master && git pull
   git tag v0.9.0-rc.1
   git push origin v0.9.0-rc.1
   ```

4. The tag triggers `.github/workflows/build.yml` on Windows and Linux. With
   `--publish always` electron-builder creates (or reuses) a **draft** release
   named after the tag and uploads:
   - Windows: `Shoal-Setup-<version>.exe`, its `.blockmap`, the portable
     `Shoal-<version>-portable.exe`, `latest.yml`
   - Linux: `Shoal-<version>.AppImage`, `shoal_<version>_amd64.deb`,
     `latest-linux.yml`

   Tag builds upload nothing as a workflow artifact: the `smoke` jobs
   download the installer from the draft release itself, so a release never
   waits on artifact storage. Master and manual builds keep their installers
   as one-day artifacts for their own smoke job (the free plan's artifact
   quota is counted in GB-months, and two weeks of ~470 MB per run exhausted
   it once).

   For a release candidate (a tag with a hyphen, such as `v0.9.0-rc.2`) the
   workflow then flags the draft as a pre-release with `gh release edit`.
   electron-builder can create a draft or a pre-release but not both, and the
   draft must wait for the smoke test.

Before publishing, check what went into the package: `npx asar list
release/win-unpacked/resources/app.asar` must only show `dist`, `dist-electron`
(no `__tests__`), `node_modules` and `package.json`. Platform-level `files`
entries in the electron-builder config replace the top-level list, so never
add them. Next to `app.asar`, `resources` must hold `LICENSE.txt` (LGPL),
`COPYING.txt` (GPL), `COPYRIGHT.txt`, `THIRD_PARTY_NOTICES.txt` (written by the `beforePack` hook,
`scripts/third-party-notices.js`) and the two example plugins.
`npx @electron/fuses read --app release/win-unpacked/Shoal.exe` must show
RunAsNode and EnableNodeOptionsEnvironmentVariable disabled and
EnableEmbeddedAsarIntegrityValidation and OnlyLoadAppFromAsar enabled
(`build.electronFuses`). EnableNodeCliInspectArguments stays enabled because
Playwright needs `--inspect` for the smoke tests.

## Publishing the draft

1. Wait for both `release` jobs and both `smoke` jobs to pass. The smoke jobs
   download the installer from the draft, install it on clean Windows and
   Linux runners and run the E2E suite against it (Linux also creates kind
   clusters).
2. Download the installer of at least one platform from the draft and start it.
3. On GitHub, edit the draft:
   - Paste the `CHANGELOG.md` section as release notes.
   - Release candidates: check that **Set as a pre-release** is ticked (the
     workflow does it).
   - Stable releases: tick **Set as the latest release**.
4. Publish. Auto-update only sees published, non-draft releases.

## Verifying auto-update

Install the previous version, publish the new one, start the old app and wait
for the "Update ready" toast, then restart. The sidebar must show the new
version. This only works once the repository is public: electron-updater
cannot read the releases of a private repository without a token. The plan
for the beta: `rc.2 → rc.3` on 2026-10-29, the day the repository goes
public, and `rc.3 → 0.9.0` on 2026-11-02, which also checks that a
pre-release moves to the stable channel (`v0.9.0-rc.1` was tagged but its
draft was never published).

## Rollback

A bad release that is already published:

1. **Stop the spread.** Edit the bad release on GitHub and convert it back to
   a draft (or delete it). New installs and update checks no longer see it.
2. **Restore the previous download.** Mark the previous good release as
   **latest** so `/releases/latest` and the landing page point to it again.
3. **Ship a fix forward.** Users who already updated cannot be downgraded
   automatically (electron-updater never downgrades). Fix the bug, bump to the
   next patch version (for example `0.9.1`), and release it the normal way.
4. Note the incident in the next `CHANGELOG.md` entry.

Never re-use a version number or move an existing tag; always release a new
version.

## Repository configuration

How `Dangalcan/shoal` is set up on GitHub, so the release process above can
be trusted:

- **`master`** requires the `App (typecheck + tests)` and `gitleaks` checks,
  a linear history, and allows neither force pushes nor deletion.
- **`v*` tags** are covered by a ruleset: only repository admins can create
  them, and nobody can move or delete one. Auto-update trusts whatever a
  `v*` tag publishes, so the tag is the release key until the installers are
  code-signed.
- **Actions**: the default `GITHUB_TOKEN` is read-only (workflows that need
  more ask for it explicitly), workflows from first-time outside
  contributors wait for approval, and every action is pinned to a commit
  (Dependabot bumps the pins; the version is in the trailing comment). `build.yml` only publishes from tags and
  from pushes to `master`, never from fork pull requests.
- **Security features**: Dependabot alerts and security updates, secret
  scanning with push protection, private vulnerability reporting (the link
  in `SECURITY.md`) and CodeQL on every push and pull request.
- **Merges**: squash only, and branches are deleted after merge.
