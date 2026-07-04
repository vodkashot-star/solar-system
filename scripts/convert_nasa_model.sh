#!/usr/bin/env bash
# convert_nasa_model.sh — Convert a NASA OBJ model to a Draco-compressed GLB
# Usage:
#   npm run models:convert -- <path/to/model.obj> [output-name]
#
# Examples:
#   npm run models:convert -- "NASA-3D-Resources/3D Models/Curiosity Rover (MSL)/curiosity.obj" curiosity
#   npm run models:convert -- /path/to/Hubble.obj hubble
#
# Pipeline:
#   1. obj2gltf  — OBJ + MTL + textures → raw GLB
#   2. gltf-transform optimize  — Draco compression + texture resize to 1024px
#   3. gltf-transform validate  — sanity check
#   → Output: client/public/models/<name>.glb

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_ROOT/client/public/models"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

# ── Parse arguments ────────────────────────────────────────────────────────
OBJ_PATH="${1:-}"
if [[ -z "$OBJ_PATH" ]]; then
  echo "Usage: $0 <path/to/model.obj> [output-name]"
  echo ""
  echo "Example:"
  echo "  npm run models:convert -- \"NASA-3D-Resources/3D Models/Curiosity Rover (MSL)/curiosity.obj\" curiosity"
  exit 1
fi

if [[ ! -f "$OBJ_PATH" ]]; then
  echo "ERROR: File not found: $OBJ_PATH"
  exit 1
fi

# Derive output name from second arg or from file basename
if [[ -n "${2:-}" ]]; then
  OUTPUT_NAME="${2}"
else
  OUTPUT_NAME="$(basename "$OBJ_PATH" .obj | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"
fi

OUTPUT_GLB="$OUTPUT_DIR/${OUTPUT_NAME}.glb"
TEMP_GLB="$TEMP_DIR/${OUTPUT_NAME}-raw.glb"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NASA OBJ → GLB Conversion Pipeline"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Input :  $OBJ_PATH"
echo "  Output:  $OUTPUT_GLB"
echo ""

# ── Step 1: OBJ → raw GLB via obj2gltf ────────────────────────────────────
echo "[1/3] OBJ → GLB (obj2gltf)..."
"$PROJECT_ROOT/node_modules/.bin/obj2gltf" \
  -i "$OBJ_PATH" \
  -o "$TEMP_GLB" \
  --checkTransparency
echo "      Raw size: $(du -sh "$TEMP_GLB" | cut -f1)"

# ── Step 2: Draco compression + texture resize via gltf-transform ─────────
echo "[2/3] Optimising (Draco + texture resize to 1024px)..."
"$PROJECT_ROOT/node_modules/.bin/gltf-transform" optimize \
  "$TEMP_GLB" \
  "$OUTPUT_GLB" \
  --compress draco \
  --texture-resize 1024 \
  2>&1 | grep -v "^$" || true
echo "      Final size: $(du -sh "$OUTPUT_GLB" | cut -f1)"

# ── Step 3: Validate ───────────────────────────────────────────────────────
echo "[3/3] Validating..."
"$PROJECT_ROOT/node_modules/.bin/gltf-transform" validate "$OUTPUT_GLB" \
  2>&1 | head -8 || true

# ── Done ───────────────────────────────────────────────────────────────────
echo ""
echo "✓  $OUTPUT_GLB"
echo ""
echo "Next steps:"
echo "  1. Create client/src/assets/solar/${OUTPUT_NAME}.glb.asset.json"
echo "     Contents: {\"url\": \"/models/${OUTPUT_NAME}.glb\"}"
echo "  2. Add the spacecraft entry to bodies.ts"
echo "  3. Run: npm run check"
