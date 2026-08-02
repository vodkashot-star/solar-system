#!/usr/bin/env bash
# fetch-nasa-planets.sh — Batch fetch NASA planet GLBs from official CDN
#
# Usage:
#   npm run models:fetch [--only earth,moon]
#   npm run models:fetch -- --dry-run
#
# Sources: science.nasa.gov, svs.gsfc.nasa.gov (official NASA CDN)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Planet name → official NASA GLB CDN URL
declare -A PLANET_URLS=(
  ["earth"]="https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/e/Earth_1_12756.glb"
  ["mars"]="https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/gltf_files/24881_Mars_1_6792.glb"
  ["jupiter"]="https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/j/Jupiter_1_142984.glb"
  ["saturn"]="https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/s/Saturn_1_120536.glb"
  ["uranus"]="https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/u/Uranus_1_51118.glb"
  ["neptune"]="https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/n/Neptune_1_49528.glb"
  ["venus"]="https://solarsystem.nasa.gov/system/resources/gltf_files/2343_Venus_1_12103.glb"
  ["mercury"]="https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/m/Mercury_1_4878.glb"
  ["moon"]="https://svs.gsfc.nasa.gov/vis/a010000/a014900/a014959/moon_small.glb"
)

ONLY=""
DRY_RUN=false

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --only=*)
      ONLY="${1#*=}"
      shift
      ;;
    --only)
      ONLY="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo "Unknown arg: $1"
      echo "Usage: $0 [--only earth,moon] [--dry-run]"
      exit 1
      ;;
  esac
done

# Filter if --only specified
if [[ -n "$ONLY" ]]; then
  IFS=',' read -ra ONLY_ARR <<< "$ONLY"
  declare -A FILTERED
  for key in "${ONLY_ARR[@]}"; do
    key=$(echo "$key" | xargs)  # trim
    if [[ -n "${PLANET_URLS[$key]:-}" ]]; then
      FILTERED[$key]="${PLANET_URLS[$key]}"
    else
      echo "WARN: Unknown planet '$key', skipping"
    fi
  done
  PLANET_URLS=()
  for key in "${!FILTERED[@]}"; do
    PLANET_URLS[$key]="${FILTERED[$key]}"
  done
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NASA Planet GLB Batch Fetch & Convert"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Targets: ${!PLANET_URLS[@]}"
echo ""

for name in "${!PLANET_URLS[@]}"; do
  url="${PLANET_URLS[$name]}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Processing: $name"
  echo "URL: $url"
  
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY RUN] Would run: npm run models:convert -- \"$url\" \"$name\""
    continue
  fi
  
  # Run the convert pipeline
  if npm run models:convert -- "$url" "$name"; then
    echo "✓ $name converted successfully"
  else
    echo "✗ $name FAILED" >&2
    exit 1
  fi
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "All targets processed successfully"
echo "Run: npm run models:validate"