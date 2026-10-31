# AUR package (`shoal-bin`)

For Arch Linux users (`paru -S shoal-bin`, `yay -S shoal-bin`). `shoal-bin` repackages the upstream `.deb` instead of building from source: the release workflow builds Electron once, and the `.deb` already has the right layout (`/opt/Shoal`, the `.desktop` file, the hicolor icons, the AppArmor profile).

## What the PKGBUILD does

- `source` is `shoal_<pkgver>_amd64.deb` from the GitHub release. A `.deb` is an `ar` archive, so makepkg extracts it by itself; `package()` unpacks `data.tar.xz` into `$pkgdir`.
- `depends` are the runtime dependencies the `.deb` declares (electron-builder's defaults for the deb target; `package.json` sets none of its own), mapped to Arch packages:

  | Debian        | Arch            |
  | ------------- | --------------- |
  | libgtk-3-0    | gtk3            |
  | libnotify4    | libnotify       |
  | libnss3       | nss             |
  | libxss1       | libxss          |
  | libxtst6      | libxtst         |
  | xdg-utils     | xdg-utils       |
  | libatspi2.0-0 | at-spi2-core    |
  | libuuid1      | util-linux-libs |
  | libsecret-1-0 | libsecret       |

  The `.deb` also _recommends_ `libappindicator3-1`; Shoal has no tray icon, so it is left out.

- `optdepends`: kubectl, kind, k3d, docker and kompose, the tools Shoal runs (README, Installation).
- What the `.deb` postinst would do happens at package time: the `/usr/bin/shoal` symlink, `chrome-sandbox` as a plain `0755` executable (the SUID bit is only for kernels without user namespaces) and the AppArmor profile in `/etc/apparmor.d/shoal` (in `backup`; only read where AppArmor is enabled).
- The `.desktop` file (`/usr/share/applications/shoal.desktop`, `Exec=/opt/Shoal/shoal %U`, `StartupWMClass=shoal`) and the icons (`/usr/share/icons/hicolor/<size>/apps/shoal.png`) come straight from the `.deb`.
- `provides=(shoal)` and `conflicts=(shoal)`, so a future source package can replace it.
- `sha256sums` is `0000…` (64 zeros) until v0.9.1 is published.

## Fill the checksum and validate

On Arch, in `packaging/aur`:

```bash
updpkgsums                       # downloads the .deb and writes sha256sums (pacman-contrib)
makepkg --printsrcinfo > .SRCINFO
namcap PKGBUILD                  # static checks
makepkg -sf                      # builds shoal-bin-0.9.1-1-x86_64.pkg.tar.zst
namcap shoal-bin-*.pkg.tar.zst   # checks the built package, dependencies included
sudo pacman -U shoal-bin-*.pkg.tar.zst && shoal --version
```

Without an Arch machine, the official container image does the same (Docker, from the repository root). `--printsrcinfo` and `namcap PKGBUILD` need no download beyond the packages; `makepkg` fetches the `.deb`:

```bash
docker run --rm -v "$PWD/packaging/aur:/pkg" archlinux:base-devel bash -c '
  pacman -Syu --noconfirm --needed namcap pacman-contrib \
    gtk3 libnotify nss libxss libxtst xdg-utils at-spi2-core util-linux-libs libsecret >/dev/null &&
  useradd -m build && cp /pkg/PKGBUILD /home/build/ && cd /home/build &&
  su build -c "updpkgsums && makepkg --printsrcinfo > .SRCINFO && namcap PKGBUILD && makepkg -f" &&
  namcap shoal-bin-*.pkg.tar.zst && cp PKGBUILD .SRCINFO /pkg/'
```

On Git Bash under Windows prefix the command with `MSYS_NO_PATHCONV=1` so the `-v` path is not rewritten.

`.SRCINFO` must be regenerated whenever the PKGBUILD changes; the AUR rejects a push whose `.SRCINFO` does not match the PKGBUILD.

## Publish

Needs an AUR account with an SSH public key registered (aur.archlinux.org, My Account). The first push creates the package:

```bash
git clone ssh://aur@aur.archlinux.org/shoal-bin.git
cp packaging/aur/PKGBUILD packaging/aur/.SRCINFO shoal-bin/
cd shoal-bin
git add PKGBUILD .SRCINFO
git commit -m "Initial import: 0.9.1-1"
git push origin master
```

The AUR takes `PKGBUILD`, `.SRCINFO` and small helper files only; never commit the `.deb` or a built package. Later versions: bump `pkgver`, reset `pkgrel=1`, `updpkgsums`, `makepkg --printsrcinfo > .SRCINFO`, commit (`Update to 0.9.1`) and push. If only the PKGBUILD changes for the same upstream version, bump `pkgrel` instead.
