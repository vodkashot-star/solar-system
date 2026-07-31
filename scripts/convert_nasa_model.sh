#!/usr/bin/env bash
# convert_nasa_model.sh — Convert NASA model (OBJ or GLB URL/file) to Draco-compressed GLB
#
# Usage:
#   npm run models:convert -- <path/to/model.obj|https://url/model.glb> [output-name]
#   npm run models:convert -- --batch <urls.txt>  # batch mode: one "name|url" per line
#
# Pipeline:
#   1. Download (if URL) → OBJ/GLB
#   2. obj2gltf          — OBJ + MTL + textures → raw GLB (skip if already GLB)
#   3. gltf-transform    — Draco compression + texture resize to 1024px
#   4. gltf-transform    — validate
#   5. asset JSON        — create client/src/assets/solar/<name>.glb.asset.json
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_ROOT/client/public/models"
ASSET_DIR="$PROJECT_ROOT/client/src/assets/solar"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

BATCH_MODE=false
BATCH_FILE=""

# ── Dependency checks ──────────────────────────────────────────────────────
for bin in obj2gltf gltf-transform curl; do
  if [[ ! -x "$PROJECT_ROOT/node_modules/.bin/$bin" ]] && [[ "$bin" != "curl" ]]; then
    echo "ERROR: $bin not found. Run: npm install"
    exit 1
  fi
  if [[ "$bin" == "curl" ]] && ! command -v curl &>/dev/null; then
    echo "ERROR: curl not found"
    exit 1
  fi
done

# ── Parse arguments ────────────────────────────────────────────────────────
INPUT="${1:-}"
if [[ -z "$INPUT" ]]; then
  echo "Usage: $0 <path/to/model.obj|https://url/model.glb> [output-name]"
  echo "       $0 --batch <urls.txt>"
  echo ""
  echo "Examples:"
  echo "  npm run models:convert -- \"NASA-3D-Resources/curiosity.obj\" curiosity"
  echo "  npm run models:convert -- \"https://assets.science.nasa.gov/.../Earth.glb\" earth"
  echo "  npm run models:convert -- --batch scripts/planet-urls.txt"
  exit 1
fi

if [[ "$INPUT" == "--batch" ]]; then
  BATCH_MODE=true
  BATCH_FILE="${2:-}"
  if [[ -z "$BATCH_FILE" || ! -f "$BATCH_FILE" ]]; then
    echo "ERROR: Batch file not found: $BATCH_FILE"
    exit 1
  fi
  echo "Batch mode: reading from $BATCH_FILE"
  # Process each line
  while IFS='|' read -r name url; do
    # Skip comments and empty lines
    [[ -z "$name" || "$name" =~ ^# ]] && continue
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Batch processing: $name"
    "$0" "$url" "$name" || { echo "FAILED: $name"; exit 1; }
  done < "$BATCH_FILE"
  echo "All batch items processed"
  exit 0
fi

OUTPUT_NAME="${2:-}"
URL_REGEX='^https?://'

# Determine input type and download if needed
if [[ "$INPUT" =~ $URL_REGEX ]]; then
  # HTTP URL - download to temp
  echo "[0/4] Downloading from URL..."
  EXT="${INPUT##*.}"
  EXT="${EXT%%\?*}"  # strip query params
  EXT="${EXT,,}"     # lowercase
  if [[ "$EXT" != "glb" && "$EXT" != "obj" && "$EXT" != "gltf" ]]; then
    EXT="glb"  # default
  fi
  DOWNLOAD_PATH="$TEMP_DIR/input.$EXT"
  curl -L -f --retry 3 --retry-delay 2 -o "$DOWNLOAD_PATH" "$INPUT"
  INPUT="$DOWNLOAD_PATH"
  if [[ -z "$OUTPUT_NAME" ]]; then
    OUTPUT_NAME="$(basename "$INPUT" .$EXT | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"
  fi
elif [[ ! -f "$INPUT" ]]; then
  echo "ERROR: File not found: $INPUT"
  exit 1
elif [[ -z "$OUTPUT_NAME" ]]; then
  OUTPUT_NAME="$(basename "$INPUT" | sed 's/\.[^.]*$//' | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"
fi

OUTPUT_GLB="$OUTPUT_DIR/${OUTPUT_NAME}.glb"
ASSET_JSON="$ASSET_DIR/${OUTPUT_NAME}.glb.asset.json"
TEMP_GLB="$TEMP_DIR/${OUTPUT_NAME}-raw.glb"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NASA Model → Optimized GLB Pipeline"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Input :  $INPUT"
echo "  Output:  $OUTPUT_GLB"
echo ""

# ── Step 1: Convert to raw GLB (if OBJ) or copy (if GLB) ────────────────────
echo "[1/4] Preparing raw GLB..."
if [[ "$INPUT" == *.obj ]]; then
  "$PROJECT_ROOT/node_modules/.bin/obj2gltf" \
    -i "$INPUT" \
    -o "$TEMP_GLB" \
    --checkTransparency
  echo "      Raw size: $(du -sh "$TEMP_GLB" | cut -f1)"
elif [[ "$INPUT" == *.glb || "$INPUT" == *.gltf ]]; then
  # Already GLB/GLTF - copy to temp for uniform processing
  cp "$INPUT" "$TEMP_GLB"
  echo "      Input is GLB/GLTF, using directly ($(du -sh "$TEMP_GLB" | cut -f1))"
else
  echo "ERROR: Unsupported input format (must be .obj, .glb, or .gltf)"
  exit 1
fi

# ── Step 2: Draco compression + texture resize ────────────────────────────
echo "[2/4] Optimising (Draco + texture resize to 1024px)..."
mkdir -p "$OUTPUT_DIR"
# First optimize with Draco
"$PROJECT_ROOT/node_modules/.bin/gltf-transform" optimize \
  "$TEMP_GLB" \
  "$OUTPUT_GLB" \
  --compress draco \
  2>&1 | grep -v "^$" || true
# Then resize textures to max 1024px (this may decompress Draco, so re-apply after)
"$PROJECT_ROOT/node_modules/.bin/gltf-transform" resize \
  "$OUTPUT_GLB" \
  "$OUTPUT_GLB" \
  --width 1024 \
  --height 1024 \
  2>&1 | grep -v "^$" || true
# Re-apply Draco compression after resize (resize can strip it)
"$PROJECT_ROOT/node_modules/.bin/gltf-transform" optimize \
  "$OUTPUT_GLB" \
  "$OUTPUT_GLB" \
  --compress draco \
  2>&1 | grep -v "^$" || true
echo "      Final size: $(du -sh "$OUTPUT_GLB" | cut -f1)"

# ── Step 3: Validate ──────────────────────────────────────────────────────
echo "[3/4] Validating..."
"$PROJECT_ROOT/scripts/validate_glb.sh" --quiet 2>&1 | tail -8 || true

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