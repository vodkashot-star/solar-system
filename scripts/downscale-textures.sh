#!/bin/bash
# Downscale Earth, Mercury, Mars GLB models for mobile performance.
# These are the heaviest models in the scene.
# Run from project root: bash scripts/downscale-textures.sh

set -e

echo "Downscaling Earth, Mercury, Mars GLB models from 4K to 2K..."
echo ""

MODELS_DIR="client/public/models"

# Create backups
for f in earth mercury mars; do
  if [ ! -f "$MODELS_DIR/$f.glb.bak" ]; then
    cp "$MODELS_DIR/$f.glb" "$MODELS_DIR/$f.glb.bak"
    echo "Backed up $f.glb -> $f.glb.bak"
  fi
done

echo ""

# Earth: 4096x2048 texture -> 2048x1024
echo "--- Earth ---"
npx gltf-transform resize "$MODELS_DIR/earth.glb" /tmp/earth-resized.glb --width 2048 --height 1024
cp /tmp/earth-resized.glb "$MODELS_DIR/earth.glb"
ls -lh "$MODELS_DIR/earth.glb"

echo ""

# Mercury: 4096x2048 texture -> 2048x1024
echo "--- Mercury ---"
npx gltf-transform resize "$MODELS_DIR/mercury.glb" /tmp/mercury-resized.glb --width 2048 --height 1024
cp /tmp/mercury-resized.glb "$MODELS_DIR/mercury.glb"
ls -lh "$MODELS_DIR/mercury.glb"

echo ""

# Mars: 19 MB procedural mesh -> optimize (weld + simplify + meshopt)
echo "--- Mars (19 MB) ---"
npx gltf-transform optimize "$MODELS_DIR/mars.glb" /tmp/mars-opt.glb
cp /tmp/mars-opt.glb "$MODELS_DIR/mars.glb"
ls -lh "$MODELS_DIR/mars.glb"

echo ""
echo "Done! Total savings:"
for f in earth mercury mars; do
  orig=$(ls -l "$MODELS_DIR/$f.glb.bak" 2>/dev/null | awk '{print $5}')
  new=$(ls -l "$MODELS_DIR/$f.glb" | awk '{print $5}')
  if [ -n "$orig" ] && [ "$orig" -gt 0 ]; then
    pct=$(( (orig - new) * 100 / orig ))
    echo "  $f: $(numfmt --to=iec $orig) -> $(numfmt --to=iec $new) ($pct% reduction)"
  fi
done
