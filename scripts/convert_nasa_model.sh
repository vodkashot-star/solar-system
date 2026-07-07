#!/usr/bin/env bash
# convert_nasa_model.sh — Convert a NASA OBJ model to a Draco-compressed GLB
#
# Usage:
#   npm run models:convert -- <path/to/model.obj> [output-name]
#
# Pipeline:
#   1. obj2gltf          — OBJ + MTL + textures → raw GLB
#   2. gltf-transform    — Draco compression + texture resize to 1024px
#   3. gltf-transform    — validate
#   4. asset JSON        — create client/src/assets/solar/<name>.glb.asset.json
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_ROOT/client/public/models"
ASSET_DIR="$PROJECT_ROOT/client/src/assets/solar"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

# ── Dependency checks ──────────────────────────────────────────────────────
for bin in obj2gltf gltf-transform; do
  if [[ ! -x "$PROJECT_ROOT/node_modules/.bin/$bin" ]]; then
    echo "ERROR: $bin not found. Run: npm install"
    exit 1
  fi
done

# ── Parse arguments ────────────────────────────────────────────────────────
OBJ_PATH="${1:-}"
if [[ -z "$OBJ_PATH" ]]; then
  echo "Usage: $0 <path/to/model.obj> [output-name]"
  echo ""
  echo "Example:"
  echo "  npm run models:convert -- \"NASA-3D-Resources/curiosity.obj\" curiosity"
  exit 1
fi

if [[ ! -f "$OBJ_PATH" ]]; then
  echo "ERROR: File not found: $OBJ_PATH"
  exit 1
fi

if [[ -n "${2:-}" ]]; then
  OUTPUT_NAME="${2}"
else
  OUTPUT_NAME="$(basename "$OBJ_PATH" .obj | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"
fi

OUTPUT_GLB="$OUTPUT_DIR/${OUTPUT_NAME}.glb"
ASSET_JSON="$ASSET_DIR/${OUTPUT_NAME}.glb.asset.json"
TEMP_GLB="$TEMP_DIR/${OUTPUT_NAME}-raw.glb"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NASA OBJ → GLB Conversion Pipeline"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Input :  $OBJ_PATH"
echo "  Output:  $OUTPUT_GLB"
echo ""

# ── Step 1: OBJ → raw GLB ─────────────────────────────────────────────────
echo "[1/4] OBJ → GLB (obj2gltf)..."
"$PROJECT_ROOT/node_modules/.bin/obj2gltf" \
  -i "$OBJ_PATH" \
  -o "$TEMP_GLB" \
  --checkTransparency
echo "      Raw size: $(du -sh "$TEMP_GLB" | cut -f1)"

# ── Step 2: Draco compression + texture resize ────────────────────────────
echo "[2/4] Optimising (Draco + texture resize to 1024px)..."
mkdir -p "$OUTPUT_DIR"
"$PROJECT_ROOT/node_modules/.bin/gltf-transform" optimize \
  "$TEMP_GLB" \
  "$OUTPUT_GLB" \
  --compress draco \
  --texture-resize 1024 \
  2>&1 | grep -v "^$" || true
echo "      Final size: $(du -sh "$OUTPUT_GLB" | cut -f1)"

# ── Step 3: Validate ──────────────────────────────────────────────────────
echo "[3/4] Validating..."
"$PROJECT_ROOT/node_modules/.bin/gltf-transform" validate "$OUTPUT_GLB" \
  2>&1 | head -8 || true

# ── Step 4: Create asset JSON pointer ────────────────────────────────────
echo "[4/4] Writing asset JSON..."
mkdir -p "$ASSET_DIR"
printf '{"url": "/models/%s.glb"}\n' "$OUTPUT_NAME" > "$ASSET_JSON"
echo "      $ASSET_JSON"

echo ""
echo "✓  Done: $OUTPUT_GLB"
echo ""
echo "Next steps:"
echo "  1. Add the body entry to client/src/components/solar-system/bodies.ts"
echo "     Import: import ${OUTPUT_NAME}Glb from \"@/assets/solar/${OUTPUT_NAME}.glb.asset.json\""
echo "  2. Run: npm run check"
