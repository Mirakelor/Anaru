#!/usr/bin/env bash
# Anaru installer — downloads the latest release from GitHub and installs it.
#
# Usage:
#   ./install.sh                 # Linux: extracts AppImage to ~/.local/share/anaru, launcher at ~/.local/bin/anaru
#   ./install.sh --deb           # Linux: install the .deb via apt
#   ./install.sh --version v0.1.8
#   ./install.sh                 # macOS: download the .dmg and open it
set -euo pipefail

REPO="${ANARU_REPO:-Mirakelor/Anaru}"
VERSION="${ANARU_VERSION:-}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [[ -z "$VERSION" ]]; then
  echo "→ Resolving latest release of $REPO…"
  VERSION="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1)"
fi
echo "→ Version: $VERSION"

asset_url() {
  local name="$1"
  curl -fsSL "https://api.github.com/repos/$REPO/releases/tags/$VERSION" |
    sed -n 's/.*"browser_download_url": *"\([^"]*'"$name"'\)".*/\1/p' | head -1
}

OS="$(uname -s)"
ARCH="$(uname -m)"

install_linux_shortcut() {
  local apps="$HOME/.local/share/applications"
  local icons="$HOME/.local/share/icons/hicolor/512x512/apps"
  mkdir -p "$apps" "$icons"
  if [[ ! -f "$icons/anaru.png" ]]; then
    echo "→ Fetching app icon…"
    curl -fsSL --retry 3 -o "$icons/anaru.png" \
      "https://raw.githubusercontent.com/$REPO/main/site/icon.png" || true
  fi
  cat > "$apps/anaru.desktop" <<EOF
[Desktop Entry]
Name=Anaru
Comment=Learn Japanese by watching anime
Exec=$HOME/.local/bin/anaru
Icon=anaru
Terminal=false
Type=Application
Categories=Education;Languages;
StartupWMClass=anaru
EOF
  chmod +x "$apps/anaru.desktop"
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$apps" 2>/dev/null || true
}

case "$OS" in
  Linux)
    if [[ "$ARCH" != "x86_64" ]]; then
      echo "Unsupported architecture: $ARCH (only x86_64 releases are built)." >&2
      exit 1
    fi
    if [[ "${1:-}" == "--deb" ]]; then
      URL="$(asset_url 'amd64.deb')"
      echo "→ Downloading .deb…"
      curl -fL --retry 3 -o "$TMP/anaru.deb" "$URL"
      echo "→ Installing with apt (sudo)…"
      sudo apt-get install -y "$TMP/anaru.deb"
      echo "✔ Installed. Run: anaru"
    else
      URL="$(asset_url 'amd64.AppImage')"
      echo "→ Downloading AppImage…"
      curl -fL --retry 3 -o "$TMP/anaru.AppImage" "$URL"
      chmod +x "$TMP/anaru.AppImage"
      # Extract to disk instead of running from the archive: the AppImage serves
      # its code pages over FUSE, and replacing the AppImage file while the app
      # runs makes the next page-in fail with SIGBUS (WebProcess dies, UI freezes).
      APPDIR="$HOME/.local/share/anaru"
      echo "→ Extracting app to $APPDIR…"
      (cd "$TMP" && "$TMP/anaru.AppImage" --appimage-extract >/dev/null)
      mkdir -p "$HOME/.local/bin" "$HOME/.local/share"
      rm -rf "$APPDIR"
      mv "$TMP/squashfs-root" "$APPDIR"
      cat > "$HOME/.local/bin/anaru" <<'EOF'
#!/bin/sh
APPDIR="$HOME/.local/share/anaru"
export APPDIR
export GDK_BACKEND=x11
export LD_LIBRARY_PATH="$APPDIR/usr/lib:$APPDIR/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export XDG_DATA_DIRS="$APPDIR/usr/share:/usr/share${XDG_DATA_DIRS:+:$XDG_DATA_DIRS}"
export GSETTINGS_SCHEMA_DIR="$APPDIR/usr/share/glib-2.0/schemas"
export GIO_EXTRA_MODULES="$APPDIR/usr/lib/x86_64-linux-gnu/gio/modules"
export GTK_PATH="$APPDIR/usr/lib/x86_64-linux-gnu/gtk-3.0"
export GTK_IM_MODULE_FILE="$APPDIR/usr/lib/x86_64-linux-gnu/gtk-3.0/3.0.0/immodules.cache"
export GDK_PIXBUF_MODULE_FILE="$APPDIR/usr/lib/x86_64-linux-gnu/gdk-pixbuf-2.0/2.10.0/loaders.cache"
export GST_PLUGIN_SYSTEM_PATH_1_0="$APPDIR/usr/lib/gstreamer-1.0"
cd "$APPDIR/usr" || exit 1
exec "$APPDIR/usr/bin/anaru" "$@"
EOF
      chmod +x "$HOME/.local/bin/anaru"
      install_linux_shortcut
      echo "✔ Installed to $APPDIR"
      echo "  (add ~/.local/bin to PATH if needed: export PATH=\"\$HOME/.local/bin:\$PATH\")"
      echo "  Run: anaru"
    fi
    ;;
  Darwin)
    URL="$(asset_url 'amd64.dmg')"
    if [[ -z "$URL" ]]; then
      URL="$(asset_url 'aarch64.dmg')"
    fi
    echo "→ Downloading .dmg…"
    curl -fL --retry 3 -o "$TMP/anaru.dmg" "$URL"
    hdiutil attach "$TMP/anaru.dmg" -nobrowse -mountpoint "$TMP/mnt"
    echo "→ Copying Anaru.app to /Applications (sudo)…"
    sudo cp -R "$TMP/mnt/Anaru.app" /Applications/
    hdiutil detach "$TMP/mnt" >/dev/null
    echo "✔ Installed. Run: open /Applications/Anaru.app"
    ;;
  *)
    echo "Unsupported OS: $OS" >&2
    exit 1
    ;;
esac
