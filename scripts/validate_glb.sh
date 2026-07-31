#!/usr/bin/env bash
# validate_glb.sh — Validate all GLB files in the project
#
# Usage:
#   npm run models:validate
#   ./scripts/validate_glb.sh [--fix] [--json] [--quiet]
#
# Options:
#   --fix     Attempt to re-compress and fix invalid GLBs using gltf-transform
#   --json    Output results as JSON
#   --quiet   Suppress per-file output, only show summary

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MODELS_DIR="$PROJECT_ROOT/client/public/models"
ASSETS_DIR="$PROJECT_ROOT/client/src/assets/solar"
GLTF_TRANSFORM="$PROJECT_ROOT/node_modules/.bin/gltf-transform"
VALIDATE_PY="$SCRIPT_DIR/validate_glb_files.py"

FIX_MODE=false
JSON_OUTPUT=false
QUIET=false

for arg in "$@"; do
  case "$arg" in
    --fix) FIX_MODE=true ;;
    --json) JSON_OUTPUT=true ;;
    --quiet) QUIET=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

if [[ ! -x "$GLTF_TRANSFORM" ]]; then
  echo "ERROR: gltf-transform not found at $GLTF_TRANSFORM"
  echo "Run: npm install"
  exit 1
fi

if [[ ! -d "$MODELS_DIR" ]]; then
  echo "ERROR: Models directory not found: $MODELS_DIR"
  exit 1
fi

# In --json mode, all human-readable output goes to stderr; stdout carries pure JSON only
if [[ "$JSON_OUTPUT" == "true" ]]; then
  exec 3>&1
  exec 1>&2
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GLB Validation Report"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Models dir:  $MODELS_DIR"
echo "  Assets dir:  $ASSETS_DIR"
echo ""

# Run Python validation once for all models
PY_OUTPUT=$(python3 "$VALIDATE_PY" 2>&1 || true)

# Parse Python output
TOTAL=0
VALID=0
INVALID=0
MISSING=0

while IFS= read -r line; do
  if [[ "$line" =~ ^Total:\ ([0-9]+)\ valid,\ ([0-9]+)\ invalid,\ ([0-9]+)\ missing ]]; then
    VALID="${BASH_REMATCH[1]}"
    INVALID="${BASH_REMATCH[2]}"
    MISSING="${BASH_REMATCH[3]}"
    TOTAL=$((VALID + INVALID + MISSING))
  fi
done <<< "$PY_OUTPUT"

# Now do detailed per-model checks with glTF inspect
declare -a RESULTS=()
MISSING_ASSET=0
MISSING_Draco=0
EXTERNAL_TEXTURES=0
FIXED=0

for glb in "$MODELS_DIR"/*.glb; do
  [[ -f "$glb" ]] || continue
  name="$(basename "$glb" .glb)"
  asset_json="$ASSETS_DIR/${name}.glb.asset.json"
  
  status="valid"
  issues=()
  size_bytes=0
  has_draco=false
  
  if [[ -f "$glb" ]]; then
    size_bytes=$(stat -c%s "$glb" 2>/dev/null || stat -f%z "$glb" 2>/dev/null)
  fi
  
  # Check asset JSON
  if [[ ! -f "$asset_json" ]]; then
    status="invalid"
    issues+=("Missing asset JSON: $asset_json")
    MISSING_ASSET=$((MISSING_ASSET + 1))
  else
    asset_url=$(jq -r '.url // empty' "$asset_json" 2>/dev/null || echo "")
    if [[ -n "$asset_url" && "$asset_url" != "/models/${name}.glb" ]]; then
      issues+=("Asset JSON URL mismatch: expected /models/${name}.glb, got $asset_url")
    fi
  fi
  
  # Check if Python validation found it invalid
  if echo "$PY_OUTPUT" | grep -q "^${name}.*✗ INVALID"; then
    status="invalid"
    err=$(echo "$PY_OUTPUT" | grep "^${name}.*✗ INVALID" | sed 's/.*✗ INVALID *//')
    issues+=("GLB header invalid: $err")
  fi
  
  # Check for Draco compression (fast binary check)
  if strings "$glb" 2>/dev/null | grep -qi "draco"; then
    has_draco=true
  elif "$GLTF_TRANSFORM" inspect "$glb" 2>&1 | head -20 | grep -qi "draco"; then
    has_draco=true
  fi
  
  if [[ "$has_draco" != "true" ]]; then
    issues+=("No Draco compression detected")
    MISSING_Draco=$((MISSING_Draco + 1))
  fi

  # Check for external texture references (images with uri instead of embedded bufferView)
  external_count=$(python3 -c "
import json, struct
with open('$glb', 'rb') as f:
    d = f.read()
off = 12
while off < len(d):
    clen, ctype = struct.unpack('<II', d[off:off+8])
    if ctype == 0x4E4F534A:
        j = json.loads(d[off+8:off+8+clen])
        print(sum(1 for i in j.get('images', []) if 'uri' in i))
        break
    off += 8 + clen
" 2>/dev/null || echo 0)
  if (( external_count > 0 )); then
    issues+=("${external_count} external texture ref(s) — loose files in models/ are required, do not delete")
    EXTERNAL_TEXTURES=$((EXTERNAL_TEXTURES + 1))
  fi
  
  # Check file size
  size_mb=$((size_bytes / 1024 / 1024))
  max_mb=10
  case "$name" in
    jwst|voyager|voyager-2|new-horizons|juno-spacecraft|dragonfly|curiosity|cassini|hubble|apollo-lm)
      max_mb=5 ;;
  esac
  
  if (( size_mb > max_mb )); then
    issues+=("File size ${size_mb}MB exceeds recommended ${max_mb}MB for ${name}")
  fi
  
  # Fix mode: re-optimize models without Draco or invalid
  if [[ "$FIX_MODE" == "true" && ( "$status" == "invalid" || "$has_draco" != "true" ) ]]; then
    temp_glb=$(mktemp --suffix=.glb)
    if "$GLTF_TRANSFORM" optimize "$glb" "$temp_glb" --compress draco 2>&1 | grep -v "^$" || true; then
      mv "$temp_glb" "$glb"
      status="fixed"
      FIXED=$((FIXED + 1))
      issues=("Fixed by re-optimizing with Draco compression")
    else
      rm -f "$temp_glb"
    fi
  fi
  
  result_json=$(jq -n \
    --arg name "$name" \
    --arg status "$status" \
    --argjson size "$size_bytes" \
    --argjson has_draco "$has_draco" \
    --arg issues "$(IFS='; '; echo "${issues[*]}")" \
    '{name: $name, status: $status, size_bytes: $size, has_draco: $has_draco, issues: ($issues | split("; ") | map(select(. != "")))}')
  
  RESULTS+=("$result_json")
  
  if [[ "$QUIET" != "true" ]]; then
    icon="✓"
    [[ "$status" == "invalid" ]] && icon="✗"
    [[ "$status" == "fixed" ]] && icon="⟳"
    printf "  %s %-20s %6.2f MB  Draco: %-5s  %s\n" "$icon" "$name" "$(echo "scale=2; $size_bytes/1024/1024" | bc)" "$( [[ "$has_draco" == "true" ]] && echo "yes" || echo "no" )" "$(IFS='; '; echo "${issues[*]}")"
  fi
done

# Check for asset JSONs without GLB files
for asset in "$ASSETS_DIR"/*.glb.asset.json; do
  [[ -f "$asset" ]] || continue
  name=$(basename "$asset" .glb.asset.json)
  if [[ ! -f "$MODELS_DIR/${name}.glb" ]]; then
    if [[ "$QUIET" != "true" ]]; then
      printf "  ✗ %-20s MISSING    ✗ NOT FOUND   Missing GLB file\n" "$name"
    fi
    TOTAL=$((TOTAL + 1))
    INVALID=$((INVALID + 1))
    MISSING_ASSET=$((MISSING_ASSET + 1))
    result_json=$(jq -n --arg name "$name" --arg status "invalid" --argjson size 0 --argjson has_draco false --arg issues "Missing GLB file" '{name: $name, status: $status, size_bytes: $size, has_draco: $has_draco, issues: ($issues | split("; ") | map(select(. != "")))}')
    RESULTS+=("$result_json")
  fi
done

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Total models:    $TOTAL"
echo "  Valid:           $VALID"
echo "  Invalid:         $INVALID"
echo "  Missing asset:   $MISSING_ASSET"
echo "  Missing Draco:   $MISSING_Draco"
echo "  Ext. textures:   $EXTERNAL_TEXTURES (warn)"
[[ ${FIXED:-0} -gt 0 ]] && echo "  Fixed:           $FIXED"

# JSON output
if [[ "$JSON_OUTPUT" == "true" ]]; then
  jq -n --argjson results "[$(IFS=,; echo "${RESULTS[*]}")]" \
    --argjson total "$TOTAL" \
    --argjson valid "$VALID" \
    --argjson invalid "$INVALID" \
    --argjson missing_asset "$MISSING_ASSET" \
    --argjson missing_draco "$MISSING_Draco" \
    --argjson external_textures "$EXTERNAL_TEXTURES" \
    '{results: $results, summary: {total: $total, valid: $valid, invalid: $invalid, missing_asset: $missing_asset, missing_draco: $missing_draco, external_textures: $external_textures}}' >&3
  exec 3>&-
fi

if (( INVALID > 0 )); then
  exit 1
fi
exit 0