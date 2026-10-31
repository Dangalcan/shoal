# Package manager manifests

Everything needed to put a Shoal release in the package managers, kept here so it is reviewed with the code and ready on release day. Each folder is the source of truth for one ecosystem; the published copy lives elsewhere.

| Folder               | For                                                    | Installs                                             | Published to                                                                              |
| -------------------- | ------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [`winget/`](winget/) | Windows users of winget (built into Windows 10 and 11) | `Shoal-Setup-<version>.exe`, per user, silently      | [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs), through a pull request |
| [`scoop/`](scoop/)   | Windows users of Scoop                                 | `Shoal-<version>-portable.exe`, saved as `Shoal.exe` | our bucket, `Dangalcan/scoop-shoal`                                                       |
| [`aur/`](aur/)       | Arch Linux users (`paru`, `yay`)                       | `shoal_<version>_amd64.deb`, repackaged              | the AUR, package `shoal-bin`                                                              |

Not covered: the `.deb` and the AppImage are installed from the release page directly (README, Installation); Flatpak, Snap and Homebrew wait for 1.0 and the macOS build.

All three are written for **0.9.1** (31 October 2026), the first version packaged: 0.9.0 went out the same day without the Linux package's dependencies, so the package managers start at 0.9.1. Only the hashes are missing until the release workflow builds the installers from the `v0.9.1` tag. Release candidates are not packaged (winget and the AUR would offer them as upgrades; Scoop's `checkver` only looks at the latest non-pre-release anyway).

## Release day

After `v0.9.1` is published ([RELEASE.md](../docs/RELEASE.md)), in this order:

1. **Get the SHA-256 of the three assets.** GitHub shows a digest next to each asset on the release page; from a shell:

   ```bash
   gh api repos/Dangalcan/shoal/releases/tags/v0.9.1 --jq '.assets[] | "\(.name) \(.digest)"'
   ```

   Or download the files and hash them: `certutil -hashfile <file> SHA256`, `Get-FileHash <file>`, `sha256sum <file>`.

2. **Fill the placeholders** (`0000…`, 64 zeros):
   - `winget/0.9.1/Dangalcan.Shoal.installer.yaml`, `InstallerSha256`: digest of `Shoal-Setup-0.9.1.exe`
   - `scoop/shoal.json`, `architecture.64bit.hash`: digest of `Shoal-0.9.1-portable.exe`
   - `aur/PKGBUILD`, `sha256sums`: digest of `shoal_0.9.1_amd64.deb`, then regenerate `aur/.SRCINFO`

   `grep -rn 0000000000000000 packaging/` must come back empty.

3. **Validate** each one as its README says: `winget validate --manifest packaging/winget/0.9.1`, `scoop install .\packaging\scoop\shoal.json`, `makepkg` in `packaging/aur` (or the Docker command in its README).

4. **Submit**:
   - winget: `wingetcreate submit packaging/winget/0.9.1` opens the pull request to microsoft/winget-pkgs; the pipeline installs the package in a sandbox and moderators review it.
   - Scoop: copy `scoop/shoal.json` to `bucket/shoal.json` in `Dangalcan/scoop-shoal`, run `.\bin\formatjson.ps1`, commit, push.
   - AUR: copy `aur/PKGBUILD` and `aur/.SRCINFO` into a clone of `ssh://aur@aur.archlinux.org/shoal-bin.git`, commit, push.

5. Commit the filled-in files here too, so the repository matches what was published.

## Next versions

Bump the version and the URLs in the three manifests (winget: a new `winget/<version>/` folder, as in winget-pkgs), fill the new hashes the same way and submit again: `wingetcreate update Dangalcan.Shoal --version <v> --urls <url> --submit`, a push to the bucket (or Excavator's automatic bump), `pkgver` plus a new `.SRCINFO` pushed to the AUR. The identifiers (`Dangalcan.Shoal`, `shoal`, `shoal-bin`) and the winget `ProductCode` never change.
