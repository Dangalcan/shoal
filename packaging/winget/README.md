# winget manifests (`Dangalcan.Shoal`)

For Windows users who install with `winget install Dangalcan.Shoal`. `0.9.0/` holds the manifest set of one version, in the layout [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs) keeps under `manifests/d/Dangalcan/Shoal/<version>/`. The manifests sit in their own folder because `winget validate` and `wingetcreate submit` read every file in the folder they are given, this README included.

| File                                | Purpose                                                          |
| ----------------------------------- | ---------------------------------------------------------------- |
| `Dangalcan.Shoal.yaml`              | Version manifest: identifier, version, default locale.           |
| `Dangalcan.Shoal.installer.yaml`    | The NSIS installer: URL, SHA-256, silent switches, product code. |
| `Dangalcan.Shoal.locale.en-US.yaml` | Publisher, license, description, tags, URLs.                     |

Manifest schema 1.28.0; the `# yaml-language-server` header gives editors completion and validation.

## What is fixed and what is filled in on release day

- **`InstallerSha256`** is `0000…` (64 zeros) until `v0.9.0` is published. Fill it with any of:
  - the digest GitHub shows next to the asset on the release page, also available as `gh api repos/Dangalcan/shoal/releases/tags/v0.9.0 --jq '.assets[] | "\(.name) \(.digest)"'`;
  - `certutil -hashfile Shoal-Setup-0.9.0.exe SHA256` or `(Get-FileHash Shoal-Setup-0.9.0.exe).Hash` on a downloaded copy;
  - `wingetcreate update Dangalcan.Shoal --version 0.9.0 --urls <installer url>`, once the package exists in winget-pkgs: it downloads the installer and writes the hash itself.

  winget-pkgs stores hashes in upper case; either case validates.

- **`ProductCode`** is the name of the uninstall key the installer writes under `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\`. electron-builder derives it from `build.appId` (`com.dangalcan.shoal`) as a UUID v5 in its own namespace (`50e065bc-3134-11e6-9bab-38c9862bdaf3`), so it is the same for every version and every build. Reproduce it with the repository's own electron-builder:

  ```bash
  node -e "const {UUID}=require('builder-util-runtime');console.log(UUID.v5('com.dangalcan.shoal',UUID.parse('50e065bc-3134-11e6-9bab-38c9862bdaf3')))"
  ```

  To check it against a real installation, install a published `Shoal-Setup-<version>.exe` (`release/win-unpacked` writes no registry keys) and read the key. It also shows the values behind `AppsAndFeaturesEntries`: `DisplayName` is `Shoal <version>` (electron-builder's default `uninstallDisplayName`), `Publisher` is the package.json author.

  ```powershell
  Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\90e015ac-3412-5092-8824-ab2c56388eb8' | Select-Object DisplayName, DisplayVersion, Publisher, UninstallString
  ```

- **Silent switches**: electron-builder's one-click NSIS installer takes `/S`. winget knows that default for `nullsoft`; the manifest states it anyway.
- **`Scope: user`**: the installer is per user (`perMachine` is off in `package.json`), so winget needs no elevation.
- **`ReleaseDate`**: the planned stable date (2026-11-02); correct it if the release moves.

## Validate

```powershell
winget validate --manifest packaging/winget/0.9.0
```

That is schema validation only; it does not check the hash. To install from the local manifests, enable local manifests once from an elevated shell (`winget settings --enable LocalManifestFiles`), then:

```powershell
winget install --manifest packaging/winget/0.9.0
```

## Submit

First version: `wingetcreate submit --token <github token> packaging/winget/0.9.0` opens the pull request against microsoft/winget-pkgs with the files in the right folder (`winget install wingetcreate`; a hand-made PR adding `manifests/d/Dangalcan/Shoal/0.9.0/` works too). The pipeline downloads the installer, checks the hash, installs it in a sandbox and compares the ARP entry; moderators may ask for changes on the PR.

Later versions, once `Dangalcan.Shoal` exists in the repository:

```powershell
wingetcreate update Dangalcan.Shoal --version 0.9.1 --urls https://github.com/Dangalcan/shoal/releases/download/v0.9.1/Shoal-Setup-0.9.1.exe --submit
```

It copies the previous manifests, updates version, URL and hash and opens the PR. Keep the copy here in sync: `PackageVersion`, `InstallerUrl`, `InstallerSha256`, `ReleaseDate`, `ReleaseNotesUrl`, and `DisplayName`/`DisplayVersion` in `AppsAndFeaturesEntries`.
