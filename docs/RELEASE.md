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

   Tag builds upload nothing as a workflow artifact: the `smoke` and `deb`
   jobs download the files from the draft release itself, so a release never
   waits on artifact storage. Master and manual builds keep their installers
   (and the `.deb`) as one-day artifacts for those jobs (the free plan's
   artifact quota is counted in GB-months, and two weeks of ~470 MB per run
   exhausted it once while the repository was private).

   The `deb` job installs the `.deb` on a bare `ubuntu:24.04` container
   (`scripts/check-deb.sh`) and fails when apt leaves a shared library the
   binary links unresolved. The runner image has every desktop library
   preinstalled, so the smoke job cannot notice a dependency missing from
   `build.deb.depends` in `package.json`: 0.9.0 shipped without
   `libasound2`.

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

1. Wait for both `release` jobs, both `smoke` jobs and the `deb` job to
   pass. The smoke jobs download the installer from the draft, install it on
   clean Windows and Linux runners and run the E2E suite against it (Linux
   also creates kind clusters); the deb job installs the `.deb` on a bare
   container and checks its dependencies.
2. Download the installer of at least one platform from the draft and start it.
3. Publish by **release id**, not by tag. `gh release edit <tag>` looks the
   tag up through an endpoint that never returns drafts ("release not
   found"), and `gh release create <tag>` on a tag that already has a draft
   makes a second, empty release next to it, and a published release
   without `latest.yml` breaks the updater for everyone on that version.
   Find the id, then flip the draft with the `CHANGELOG.md` section as
   notes:

   ```bash
   gh api repos/Dangalcan/shoal/releases --jq '.[] | "\(.id)\t\(.tag_name)\tdraft=\(.draft)\tassets=\(.assets|length)"'
   # release candidate
   gh api -X PATCH repos/Dangalcan/shoal/releases/<id> -F draft=false -F prerelease=true -f name=0.9.0-rc.6 -F body=@notes.md
   # stable release
   gh api -X PATCH repos/Dangalcan/shoal/releases/<id> -F draft=false -F prerelease=false -F make_latest=true -f name=0.9.0 -F body=@notes.md
   ```

   The GitHub UI works too: open the draft, **Edit**, tick **Set as a
   pre-release** (release candidates) or **Set as the latest release**
   (stable), **Publish release**. Never **Draft a new release** on the same
   tag.

4. Check that `releases.atom` lists the new version first and that
   `releases/download/<tag>/latest.yml` serves it. Auto-update only sees
   published, non-draft releases.

## Verifying auto-update

Install the previous version, publish the new one, start the old app and wait
for the "Update ready" toast, then restart. The sidebar must show the new
version. This only works once the repository is public: electron-updater
cannot read the releases of a private repository without a token. The beta
rehearsed it on 2026-10-28, the day the repository went public: an
installed rc.4 did not offer rc.5, because the service did not recognise
the wrapped error electron-updater raises when no stable release exists
and never looked at pre-releases. rc.6 fixed that, and an installed rc.6
confirmed it by logging "No stable release published yet; checking
pre-releases" and then that no newer version exists. `rc.6 → 0.9.0` on
2026-11-02 checks that a pre-release moves to the stable channel.

## When Actions cannot run

If GitHub cannot start the release jobs (the account's included minutes or
storage are used up, for example), the same artifacts can be built by hand
and uploaded to a draft. Used for `v0.9.0-rc.3` on 2026-10-24.

1. A clean checkout of the tag with its own dependencies, so the lockfile
   decides every version (the shared `node_modules` of a long-lived checkout
   may hold an older Electron):

   ```bash
   git worktree add ../shoal-rc3 v0.9.0-rc.3 && cd ../shoal-rc3 && npm ci
   ```

2. Windows, on a Windows machine:

   ```bash
   npm run build:react && npm run build:electron && npx electron-builder --win --publish never
   ```

3. Linux, from the same worktree, inside electron-builder's image (Docker
   Desktop running; the volumes keep the Linux `node_modules` and caches
   apart from the Windows ones):

   ```bash
   MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD:/project" -v shoal-rc3-nm:/project/node_modules \
     -v shoal-electron-cache:/root/.cache/electron -v shoal-npm-cache:/root/.npm -w /project \
     electronuserland/builder:22 bash -lc "npm ci && npm run build:react && npm run build:electron && npx electron-builder --linux --publish never"
   ```

4. The checks above (asar contents, `resources`, fuses), plus: the `sha512`
   in `latest.yml` and `latest-linux.yml` matches the installers
   (`openssl dgst -sha512 -binary <file> | openssl base64 -A`), the asar
   `package.json` carries the tagged version, and `dpkg-deb --info` on the
   `.deb` lists the expected dependencies. Run the E2E suite against the
   packaged executable (`SHOAL_E2E_EXECUTABLE=release/win-unpacked/Shoal.exe
npx playwright test`) in place of the Windows smoke job; the Linux smoke
   has no local substitute, so install the AppImage and the `.deb` on a Linux
   desktop by hand.

5. Upload the seven files to a draft, flagged as a pre-release for a release
   candidate, with the CHANGELOG section as notes, and publish it the usual
   way:

   ```bash
   gh release create v0.9.0-rc.3 --draft --prerelease --title "0.9.0-rc.3" --notes-file notes.md \
     release/Shoal-Setup-*.exe release/Shoal-Setup-*.exe.blockmap release/Shoal-*-portable.exe release/latest.yml \
     release/Shoal-*.AppImage release/shoal_*_amd64.deb release/latest-linux.yml
   ```

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
