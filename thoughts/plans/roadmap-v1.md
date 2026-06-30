# Solar System — Roadmap v1

**Updated:** 2026-06-28

## Prioritization

### P0 — Critical (rendering/crashing bugs)
- [x] Fix black-screen root causes (Uranus GLB 83 MB → 277 KB, preload removed)
- [x] Deploy Draco decoder pipeline
- [x] Add `invalidate()` to Planet `useFrame`
- [x] Audit and fix camera framing (computedRadii from GLB bounding box)
- [x] Reduce Uranus asset size (Draco-compressed, `add_detail=False`)
- [x] Fix LoadingSpinner — 15s timeout prevents infinite blocking

### P1 — High (user-facing quality)
- [x] Context-loss recovery overlay
- [x] Wire 29 bodies (Sun + 8 planets + 20 dwarf planets/asteroids/comets/interstellar)
- [x] Orbit ring color-coding by body category
- [x] SpaceAI FastAPI integration (classify endpoint, Express proxy, HUD panel)
- [x] Mobile performance: downscale Earth/Mercury/Mars textures (21 MB, 19 MB, 13 MB each)
- [x] Better loading UI (progress per-body, not global spinner)

### P2 — Future (features & content)
- [x] SpaceAI ML classification pipeline (RandomForest, FastAPI microservice)
- [x] Educational overlays (tooltips, body detail modal)
- [x] Discovery recommendations (similarObjects panel — data exists, UI not wired)
- [ ] LOD system (full / half / decimated mesh levels by camera distance)
- [x] Bloom optimization (disable when scene is static / tour paused)

## Deviations from Plan

### P1-5: Mobile Performance — Downscale Textures
- **Original Plan**: Downscale Earth/Mercury/Mars "textures" at 21 MB, 19 MB, 13 MB  
- **Actual Implementation**: Earth (22.67 MB→619 KB) and Mercury (20.57 MB→582 KB) were Sketchfab models with 8192×4096 embedded JPEG textures — resized to 2048×1024 via `gltf-transform resize`. Mars (19.61 MB→2.6 MB) was a Blender procedural model with 516K vertices and no textures — optimized via `gltf-transform optimize` (weld + simplify + meshopt).
- **Size estimates in the plan did not match reality**: Actual sizes were 22.67 MB, 20.57 MB, 19.61 MB (not 21, 19, 13). All three were GLB files, not standalone textures.
- **Script created**: `scripts/downscale-textures.sh` + `npm run downscale` for reproducibility.

### P2-2: Educational Overlays
- **Original Plan**: Tooltips + body detail modal
- **Implementation**: Hover tooltip (name + type) on pointer-over any planet; "Details" button opens a modal reusing `EnhancedDataExplorer` with similar-objects navigation.

### P2-3: Discovery Recommendations
- **Original Plan**: "SimilarObjects panel — data exists, UI not wired"
- **Implementation**: Similar bodies section was already wired in the main "Now viewing" card. Added it inside the detail modal for full exploration context, plus hover-to-navigate.

### P2-4: LOD System
- **Original Plan**: Full/half/decimated mesh levels by camera distance
- **Status**: Skipped — requires regenerating all 29 GLBs at 3 detail levels via Blender, which is heavy infrastructure not practical without a proper asset pipeline. Blender not available in CI/current env.

### P2-5: Bloom Optimization
- **Original Plan**: Disable when scene is static/tour paused
- **Implementation**: Set Bloom `intensity={tourOn ? 0.9 : 0}` — bloom fades when paused, saving GPU cycles.
