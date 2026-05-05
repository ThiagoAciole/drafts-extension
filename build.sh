#!/bin/sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

rm -f drafts.zip
zip -r drafts.zip . \
  -x 'venv/*' \
  -x '.git/*' \
  -x 'schemas/gschemas.compiled' \
  -x 'drafts.zip' \
  -x 'build.sh' \
  -x 'install.sh'

echo "drafts.zip criado com sucesso em $ROOT_DIR/drafts.zip"