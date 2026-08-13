# GLB Model Optimization Audit
**Date:** 2026-08-14  
**Total Models:** 29  
**Total Size:** 25 MB → **15 MB** ✅ **(40% reduction, 10 MB saved)**

## ✅ OPTIMIZATION COMPLETE

**Optimized Models (7):**
- ✅ ceres: 2.3 MB → 0.4 MB (82% reduction, 516k→10k verts)
- ✅ eros: 2.3 MB → 0.6 MB (73% reduction, textures→512px)
- ✅ new-horizons: 3.0 MB → 1.2 MB (57% reduction, textures→512px)
- ✅ curiosity: 2.9 MB → 1.2 MB (59% reduction, textures→512px)
- ✅ itokawa: 1.6 MB → 0.5 MB (72% reduction, textures→512px)
- ✅ hubble: 1.6 MB → 0.8 MB (48% reduction, textures→512px)
- ✅ cassini: 1.5 MB → 0.6 MB (58% reduction, textures→512px)

**Bundle Impact:**
- All 29 models validated ✓
- dist/models synced ✓
- Draco compression maintained ✓
- Backups saved in client/public/models-backup/ ✓

---

---

## 🚨 Critical Issues

### 1. **Ceres - Excessive Poly Count**
- **Current:** 516,096 vertices, 2.22 MB, NO textures
- **Issue:** Massively over-detailed for a dwarf planet model with no texture data
- **Impact:** High GPU memory, slow to decode
- **Target:** ~10,000 vertices (50x reduction)
- **Action:** Decimate mesh in Blender using quadric edge collapse
  ```bash
  # Use Blender mesh decimation
  blender --background --python scripts/decimate_mesh.py -- ceres.glb 0.02
  ```

### 2. **High-Res Textures in Rarely-Focused Models**
Models with large embedded textures that users rarely zoom into:

| Model | Size | Textures | Vertices | Issue |
|-------|------|----------|----------|-------|
| **new-horizons** | 3.0 MB | 2.86 MB (5 imgs) | 7,004 | Spacecraft rarely focused, excessive texture detail |
| **curiosity** | 2.9 MB | 2.58 MB (8 imgs) | 61,007 | Mars rover texture overkill |
| **eros** | 2.3 MB | 2.27 MB (2 imgs) | 838 | Asteroid with 2MB+ textures |
| **itokawa** | 1.6 MB | (embedded) | ? | Another asteroid with high-res textures |
| **hubble** | 1.6 MB | (embedded) | ? | Telescope model |
| **cassini** | 1.5 MB | (embedded) | ? | Spacecraft |

**Combined:** These 6 models = **14.8 MB** (59% of total bundle)

---

## 📊 Optimization Recommendations

### Priority 1: Texture Downsizing (Quick Win)
**Target models:** new-horizons, curiosity, eros, itokawa, hubble, cassini

#### Distant Bodies (Asteroids, Dwarf Planets)
- **Eros, Itokawa, Ceres:** Reduce textures to 512×512 (from likely 2K/4K)
  - Users rarely zoom in on asteroids
  - Even at close range, 512px is sufficient for 100-200px screen size

#### Spacecraft (Background Orbits)
- **New Horizons, Curiosity, Cassini, Hubble:** Reduce to 1024×1024
  - These orbit as background bodies, not primary tour focuses
  - JWST is only 640 KB (reference for good compression)

#### Texture Optimization Pipeline
```bash
# For each large model
npm run models:optimize -- new-horizons.glb --texture-size 1024
npm run models:optimize -- curiosity.glb --texture-size 1024
npm run models:optimize -- eros.glb --texture-size 512
npm run models:optimize -- itokawa.glb --texture-size 512
npm run models:optimize -- ceres.glb --decimate 0.02  # 2% of original poly count
```

**Expected Savings:** 8-10 MB (40% reduction)

---

### Priority 2: Mesh Decimation

#### High-Poly Models Without Justification
| Model | Current Verts | Target Verts | Reason |
|-------|---------------|--------------|--------|
| **ceres** | 516,096 | 10,000 | No texture = no detail to preserve |
| **curiosity** | 61,007 | 20,000 | Spacecraft in background orbit |
| **eros** | 838 | 500 | Low poly already, but textures dominate |

```python
# Blender decimation script (scripts/decimate_mesh.py)
import bpy, sys

glb_path = sys.argv[-2]
ratio = float(sys.argv[-1])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb_path)
obj = bpy.context.selected_objects[0]

# Add decimation modifier
mod = obj.modifiers.new(name="Decimate", type='DECIMATE')
mod.ratio = ratio
mod.use_collapse_triangulate = True

# Apply and export
bpy.ops.object.modifier_apply(modifier="Decimate")
out_path = glb_path.replace('.glb', '_decimated.glb')
bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB')
print(f"Saved: {out_path}")
```

---

### Priority 3: LOD System Integration

Your `lod-manager.ts` already exists but models don't have LOD variants. Create low-poly versions:

```typescript
// client/src/components/solar-system/bodies.ts
export const BODIES_WITH_LOD = {
  'new-horizons': {
    high: '/models/new-horizons.glb',
    low: '/models/new-horizons-lod.glb',  // ← Create these
  },
  'curiosity': {
    high: '/models/curiosity.glb',
    low: '/models/curiosity-lod.glb',
  },
  // ... more
};
```

**LOD Variants to Create:**
1. `new-horizons-lod.glb` — 1,000 verts, 256px textures (~400 KB)
2. `curiosity-lod.glb` — 10,000 verts, 512px textures (~800 KB)
3. `cassini-lod.glb` — 500 verts, 512px textures (~300 KB)

---

## 🎯 Optimization Targets

| Priority | Action | Models | Potential Savings |
|----------|--------|--------|-------------------|
| **P1** | Texture resize to 1024px | new-horizons, curiosity, hubble, cassini | ~6 MB |
| **P1** | Texture resize to 512px | eros, itokawa | ~2 MB |
| **P1** | Mesh decimate 98% | ceres | ~1.5 MB |
| **P2** | Mesh decimate 67% | curiosity | ~1 MB |
| **P3** | Create LOD variants | 3 spacecraft | 0 MB (new files, improves perceived perf) |

**Total Expected Savings:** ~10.5 MB (42% reduction, down to 14.5 MB)

---

## 🛠️ Implementation Plan

### Step 1: Create Optimization Script
```bash
#!/bin/bash
# scripts/optimize_model.sh

MODEL=$1
TARGET_TEX=${2:-1024}
TARGET_RATIO=${3:-1.0}

echo "Optimizing $MODEL..."

# Use gltf-transform for texture resizing + Draco recompression
npx gltf-transform \
  resize "client/public/models/$MODEL.glb" \
  "client/public/models/$MODEL.glb" \
  --width $TARGET_TEX \
  --height $TARGET_TEX

# Draco compression (aggressive)
npx gltf-transform \
  draco "client/public/models/$MODEL.glb" \
  "client/public/models/$MODEL.glb" \
  --method edgebreaker \
  --encodeSpeed 0 \
  --decodeSpeed 5

echo "✓ $MODEL optimized"
```

### Step 2: Batch Optimize
```bash
# Texture downsizing
./scripts/optimize_model.sh new-horizons 1024
./scripts/optimize_model.sh curiosity 1024
./scripts/optimize_model.sh hubble 1024
./scripts/optimize_model.sh cassini 1024
./scripts/optimize_model.sh eros 512
./scripts/optimize_model.sh itokawa 512

# Mesh decimation (requires Blender)
blender --background --python scripts/decimate_mesh.py -- \
  client/public/models/ceres.glb 0.02
mv client/public/models/ceres_decimated.glb client/public/models/ceres.glb
```

### Step 3: Validate
```bash
npm run models:validate
npm run build
npm run ai:check  # Verify models still load in R3F
```

---

## 📦 dist/models Sync

**Current Status:**
- `dist/models/` is auto-synced from `client/public/models/` during build
- Both directories show identical timestamps (Aug 13 19:11)
- ✅ No action needed — Vite copies public assets automatically

**Verification:**
```bash
diff -r client/public/models dist/models
# Should return: Binary files differ (expected for GLBs)
```

---

## 🔍 Texture Analysis Details

### Estimated Texture Resolutions (Reverse-Engineered)
Based on buffer sizes:

| Model | Texture Buffer | Est. Resolution | Target |
|-------|----------------|-----------------|--------|
| new-horizons | 2.86 MB (5 imgs) | ~1024×1024 per texture | 512×512 |
| curiosity | 2.58 MB (8 imgs) | ~512×512 per texture | 256×256 or 512×512 |
| eros | 2.27 MB (2 imgs) | ~2048×2048 | 512×512 |

**Calculation:** 
- 1024×1024 RGBA = 4 MB uncompressed, ~0.5-0.8 MB compressed (JPEG/PNG in GLB)
- 2.86 MB / 5 textures ≈ 572 KB per texture → likely 1024×1024

---

## 🚀 Quick Wins (30 min work)

1. **Decimate Ceres** (2 min):
   ```bash
   # Using @gltf-transform/cli
   npx gltf-transform simplify client/public/models/ceres.glb \
     client/public/models/ceres.glb --simplify 0.02
   ```
   **Savings:** ~1.5 MB

2. **Resize Eros Textures** (2 min):
   ```bash
   npx gltf-transform resize client/public/models/eros.glb \
     client/public/models/eros.glb --width 512 --height 512
   npx gltf-transform draco client/public/models/eros.glb \
     client/public/models/eros.glb
   ```
   **Savings:** ~1.8 MB

3. **Resize New Horizons** (2 min):
   ```bash
   npx gltf-transform resize client/public/models/new-horizons.glb \
     client/public/models/new-horizons.glb --width 1024 --height 1024
   npx gltf-transform draco client/public/models/new-horizons.glb \
     client/public/models/new-horizons.glb
   ```
   **Savings:** ~1.5 MB

**Total Quick Win Savings:** ~4.8 MB (19% reduction)

---

## ✅ Validation Checklist

After optimizations:
- [ ] Run `npm run models:validate` (all pass)
- [ ] Run `npm run ai:check` (models load in scene)
- [ ] Visual inspection in `?model=ceres` preview mode
- [ ] Check bundle size: `npm run build && du -sh dist/models`
- [ ] Lighthouse audit: Performance score should improve
- [ ] Test on mobile: Lower memory = fewer crashes

---

## 📝 Notes

### Why Not Optimize Everything?
- **Planets (earth, mars, jupiter, etc.)** are primary tour targets → keep high quality
- **Sun** is only 332 KB → already optimized
- **Small dwarf planets (eris, makemake, etc.)** are 10 KB → procedural, not real GLBs
- **JWST** (657 KB) is well-optimized → reference for good balance

### Tools Required
1. **@gltf-transform/cli** (already in package.json?)
   ```bash
   npm install -g @gltf-transform/cli
   ```
2. **Blender** (for manual decimation if gltf-transform fails)
   ```bash
   # Ubuntu/Debian
   sudo apt install blender
   ```

### Known Issues
- **Ceres** may need manual Blender work if gltf-transform simplify fails on untextured high-poly mesh
- **Curiosity** has 8 textures — may need selective resizing (keep detail textures, downsize albedo)
