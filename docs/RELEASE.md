# Release Process

How a Shoal release is cut, published and, if needed, rolled back.

The version in `package.json` is the single source of truth. The app shows it
in the sidebar (`v` + `app.getVersion()`) and electron-updater compares against
it. Tags are `v` + that version.

## Versions

| Kind              | Example      | GitHub release           | Who gets it through auto-update          |
| ----------------- | ------------ | ------------------------ | ---------------------------------------- |
| Release candidate | `0.9.0-rc.1` | Published as pre-release | Only users already on a pre-release      |
| Stable            | `0.9.0`      | Published as release     | Everyone (and the landing page download) |
| Patch             | `0.9.1`      | Published as release     | Everyone                                 |

The landing page links to `/releases/latest`, which GitHub resolves to the
newest **non** pre-release.

## Cutting a release

1. Make sure `master` is green (CI, gitleaks, Build/Release).
2. On a branch, bump `version` in `package.json` (and the two version fields at
   the top of `package-lock.json`), add the section to `CHANGELOG.md`, open a
   PR and merge it.
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

   The same files are also kept as workflow artifacts for 14 days.

   For a release candidate (a tag with a hyphen, such as `v0.9.0-rc.2`) the
   workflow then flags the draft as a pre-release with `gh release edit`.
   electron-builder can create a draft or a pre-release but not both, and the
   draft must wait for the smoke test.

Before publishing, check what went into the package: `npx asar list
release/win-unpacked/resources/app.asar` must only show `dist`, `dist-electron`
(no `__tests__`), `node_modules` and `package.json`. Platform-level `files`
entries in the electron-builder config replace the top-level list, so never
add them. Next to `app.asar`, `resources` must hold `LICENSE.txt`,
`COPYRIGHT.txt`, `THIRD_PARTY_NOTICES.txt` (written by the `beforePack` hook,
`scripts/third-party-notices.js`) and the two example plugins.
`npx @electron/fuses read --app release/win-unpacked/Shoal.exe` must show
RunAsNode and EnableNodeOptionsEnvironmentVariable disabled and
EnableEmbeddedAsarIntegrityValidation and OnlyLoadAppFromAsar enabled
(`build.electronFuses`). EnableNodeCliInspectArguments stays enabled because
Playwright needs `--inspect` for the smoke tests.

## Publishing the draft

1. Wait for both `release` jobs and both `smoke` jobs to pass. The smoke jobs
   install the new package on clean Windows and Linux runners and run the E2E
   suite against it (Linux also creates kind clusters).
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
cannot read the releases of a private repository without a token. During the
beta it is checked for `rc.2 → rc.3` right after the repository goes public.

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
