#!/usr/bin/env bash
# copy-draco.sh — Copy Draco WASM decoder files to public/ and dist/
#
# drei's useGLTF / three-stdlib DRACOLoader looks for these files at /draco/
# at runtime. Must run before both dev server start and production build.
#
# three >= 0.160 ships draco in:
#   node_modules/three/examples/jsm/libs/draco/
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Prefer the root draco folder (used by three-stdlib / drei)
DRACO_SRC="$PROJECT_ROOT/node_modules/three/examples/jsm/libs/draco"

if [[ ! -d "$DRACO_SRC" ]]; then
  echo "ERROR: Draco source not found at $DRACO_SRC"
  echo "       Run: npm install"
  exit 1
fi

DRACO_FILES=(draco_decoder.wasm draco_decoder.js draco_wasm_wrapper.js)

copy_to() {
  local DST="$1"
  mkdir -p "$DST"
  for f in "${DRACO_FILES[@]}"; do
    cp "$DRACO_SRC/$f" "$DST/$f"
  done
  echo "Draco → $DST/"
}

# Always copy to client/public (dev server + build input)
copy_to "$PROJECT_ROOT/client/public/draco"

# Also copy to dist/ if it already exists (production build)
if [[ -d "$PROJECT_ROOT/dist" ]]; then
  copy_to "$PROJECT_ROOT/dist/draco"
fi
