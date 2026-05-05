#!/bin/sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/drafts@thiago.aciole"

rm -rf "$INSTALL_DIR"
cp -r "$ROOT_DIR" "$INSTALL_DIR"
glib-compile-schemas "$INSTALL_DIR/schemas"
gnome-extensions disable drafts@thiago.aciole || true
gnome-extensions enable drafts@thiago.aciole

echo "Extensão instalada em $INSTALL_DIR"