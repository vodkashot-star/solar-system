#!/bin/bash
# Copy Draco decoder files from node_modules to public directory
# Required for compressed GLB loading at runtime
set -euo pipefail

SRC="node_modules/three/examples/jsm/libs/draco"
DST="client/public/draco"

mkdir -p "$DST"
cp "$SRC/draco_decoder.wasm" "$DST/"
cp "$SRC/draco_decoder.js" "$DST/"
cp "$SRC/draco_wasm_wrapper.js" "$DST/"

echo "Draco decoder files copied to $DST/"
