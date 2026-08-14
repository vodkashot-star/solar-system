#!/usr/bin/env bash
# Convert all GLB models to USDZ for iOS AR Quick Look.
# Usage: npm run models:usdz          (all models)
#        npm run models:usdz -- earth  (single model)
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/export_usdz.mjs "$@"
