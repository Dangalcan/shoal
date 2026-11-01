#!/usr/bin/env bash
# Installs a Shoal .deb on a bare Debian or Ubuntu system and checks that apt
# pulled in every shared library the binary links.
#
# The Build/Release workflow runs it inside a clean ubuntu:24.04 container
# (job `deb`): the GitHub runner image already has every desktop library
# Electron needs, so the smoke job cannot notice a dependency missing from
# the package's Depends list (0.9.0 shipped without libasound2). Locally:
#
#   docker run --rm -v "$PWD/release:/pkg:ro" -v "$PWD/scripts/check-deb.sh:/check-deb.sh:ro" \
#     ubuntu:24.04 bash /check-deb.sh /pkg/shoal_<version>_amd64.deb
set -euo pipefail

deb="${1:?usage: check-deb.sh /path/to/shoal_<version>_amd64.deb}"
[ -f "$deb" ] || { echo "::error::$deb does not exist"; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
if ! apt-get install -y -qq --no-install-recommends "$deb" > /tmp/apt-install.log 2>&1; then
  tail -n 40 /tmp/apt-install.log
  echo "::error::apt could not install ${deb##*/}"
  exit 1
fi

dpkg-query -W -f='${Package} ${Version}\nDepends: ${Depends}\n' shoal

link="$(readlink -f /usr/bin/shoal || true)"
if [ "$link" != "/opt/Shoal/shoal" ]; then
  echo "::error::/usr/bin/shoal should point at /opt/Shoal/shoal, found '${link:-nothing}'"
  exit 1
fi

missing="$(ldd /opt/Shoal/shoal | grep 'not found' || true)"
if [ -n "$missing" ]; then
  echo "::error::shared libraries still missing after apt install (add them to build.deb.depends in package.json):"
  echo "$missing"
  exit 1
fi

echo "ok: ${deb##*/} installs on a bare system and every linked library resolves"
