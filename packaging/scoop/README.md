# Scoop manifest (`shoal`)

For Windows users who prefer Scoop. The manifest installs the portable build (`Shoal-<version>-portable.exe`, saved as `Shoal.exe`): no installer, no registry keys, and Scoop does the updating, since the portable build never updates itself.

Install, once the bucket exists:

```powershell
scoop bucket add shoal https://github.com/Dangalcan/scoop-shoal
scoop install shoal
```

## Where the file lives

`shoal.json` is copied to `bucket/shoal.json` in the bucket repository `Dangalcan/scoop-shoal`, to be created from [ScoopInstaller/BucketTemplate](https://github.com/ScoopInstaller/BucketTemplate) (the template brings the Pester tests, the `bin/` scripts and the Excavator workflow that bumps manifests automatically). The copy here is the source of truth; the bucket is where Scoop reads it from.

## Fields

- `architecture.64bit.url` ends in `#/Shoal.exe`: Scoop saves the download under that name and does not try to extract it (the portable build is a self-extracting executable that unpacks itself into `%TEMP%` on each start).
- `hash` is `0000…` (64 zeros) until v0.9.1 is published. Scoop takes the plain hex SHA-256.
- `bin` and `shortcuts` put `Shoal.exe` on PATH and in the Start menu.
- `suggest` lists the Scoop packages of the tools Shoal drives; Scoop mentions them after the install.
- `checkver.github` reads `/releases/latest`, which GitHub resolves to the newest non-pre-release, so release candidates are never picked up.
- `autoupdate` rewrites the URL for the version `checkver` finds; with no `hash` entry of its own, Scoop downloads the file and computes the hash.

## Fill the hash and validate

In the bucket repository, after copying the file:

```powershell
.\bin\checkver.ps1 shoal -u   # finds the latest stable release, downloads the portable exe, writes url and hash
.\bin\formatjson.ps1 shoal    # the bucket's JSON style (this repository uses Prettier instead)
.\bin\test.ps1                # the template's Pester tests: schema, hash format, URL
```

Without the bucket, the hash is the release asset digest (see `packaging/README.md`) or `(Get-FileHash Shoal-0.9.1-portable.exe).Hash`, and a local install tests the manifest directly:

```powershell
scoop install .\packaging\scoop\shoal.json
```

## Publish

Commit `bucket/shoal.json` and push to `Dangalcan/scoop-shoal`. Users get the new version with `scoop update shoal`. Later releases: Excavator (the template's scheduled workflow) runs `checkver -u` and commits the bump, or run it by hand as above.
