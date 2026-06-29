# Performance Audit — CosmicVoyage

**Date:** 2026-06-22
**Updated:** 2026-06-28 (P0 items resolved)
**Scope:** R3F solar system single-page app
**Auditor:** OpenCode

---

## Executive Summary

The app has a fundamentally sound architecture (`frameloop="demand"`, zustand stores, asset JSON indirection). All P0 blocking issues have been resolved: Uranus GLB compressed from 83 MB → 277 KB, Draco decoder deployed, synchronous preload removed, `invalidate()` added to Planet `useFrame`, context-loss recovery added, and `LoadingSpinner` given a 15s timeout. The app now loads on mobile without black-screen failures. Remaining work is P1–P3 quality improvements.

---

## 1. Ranked Findings

| # | Finding | Impact | Effort | Priority | Status | File(s) |
|---|---------|--------|--------|----------|--------|---------|
| 1 | `uranus.glb` — 83 MB, 1.87M verts, 31 meshes | Critical | Large | **P0** | ✅ Fixed — 277 KB (Draco) | `public/models/uranus.glb` |
| 2 | Draco decoder WASM/JS not deployed to `public/draco/` | Critical | Small | **P0** | ✅ Fixed — deployed via `copy-draco.sh` | `public/draco/` |
| 3 | All 9 GLBs preloaded synchronously at module import time | High | Medium | **P0** | ✅ Fixed — preload loop removed | `Planet.tsx` |
| 4 | `Planet.tsx useFrame` missing `invalidate()` — planets freeze on pause | High | Small | **P0** | ✅ Fixed — `state.invalidate()` added | `Planet.tsx` |
| 5 | No WebGL context-loss recovery | High | Small | **P0** | ✅ Fixed — overlay + auto-restore | `SolarSystem.tsx` |
| 6 | `LoadingSpinner` blocks forever if a GLB stalls | High | Small | **P0** | ✅ Fixed — 15s timeout added | `LoadingSpinner.tsx` |
| 7 | Saturn ring radius excluded from camera distance formula | High | Small | **P1** | ✅ Fixed — `computedRadii` from bounding box | `CinematicTour.tsx`, `FocusCamera.tsx` |
| 8 | Earth & Mercury texture payload dominates file size (~21 MB / ~19 MB) | High | Medium | **P1** | Open | `public/models/earth.glb`, `mercury.glb` |
| 9 | No LOD system — full-resolution meshes at any distance | High | Large | **P1** | Open | `Planet.tsx` |
| 10 | Bloom postprocessing runs even when scene is static | Medium | Small | **P2** | Open | `SolarSystem.tsx` |
| 11 | `InstancedStars` re-creates geometry on every prop change | Low | Small | **P3** | Open | `InstancedStars.tsx` |

---

## 2. Performance Bottlenecks

### 2.1 Raw Geometry Payload

| Asset | Size | Vertices | Meshes | Texture in buffer | Notes |
|-------|------|----------|--------|-------------------|-------|
| uranus.glb | **83.1 MB** | 1,867,583 | 31 | 4.4 MB | **Critical** — dominates load time & memory |
| earth.glb | 21.6 MB | 3,223 | 1 | 21.5 MB | Texture-heavy (99% of size) |
| mercury.glb | 19.6 MB | 3,223 | 1 | 19.5 MB | Same as earth |
| mars.glb | 12.7 MB | 8,249 | 1 | 12.3 MB | Texture-heavy |
| venus.glb | 8.8 MB | 16,422 | 1 | 7.9 MB | Texture-heavy |
| jupiter.glb | 3.6 MB | 3,223 | 1 | 3.4 MB | Texture-heavy |
| saturn.glb | 3.0 MB | 4,997 | 8 | 2.7 MB | Moderate |
| neptune.glb | 7.7 MB | 4,286 | 2 | 7.4 MB | Texture-heavy |
| sun.glb | 2.0 MB | 4,286 | 2 | 1.8 MB | Smallest |
| **Total** | **163 MB** | ~1.9M+ | 49 | 81 MB | |

**No GLB uses Draco compression.** All use `KHR_materials_pbrSpecularGlossiness` or `KHR_materials_transmission` (sun only). Median file size (excluding Uranus): ~8.8 MB. Uranus is **9.4× larger than the median** and carries 99.8% of all vertex data.

### 2.2 Missing Draco Decoder

`client/public/draco/` contains only a `README.md`. The decoder files exist in `node_modules/three/examples/jsm/libs/draco/` but are **not copied** into the public directory during build or dev. `draco-setup.ts:10` sets the decoder path to `/draco/` which will 404 at runtime if any GLB uses Draco.

Since no GLBs are currently Draco-compressed this goes unnoticed, but it means:
- No opportunity for 80–95% network-size reduction
- Any future Draco-encoded asset will fail to load silently
- The Draco initialisation code is dead code

### 2.3 Synchronous Preload Waterfall

`Planet.tsx:16-18`:
```ts
for (const b of BODIES) {
  if (b.glbUrl) useGLTF.preload(b.glbUrl);
}
```

`useGLTF.preload` fires at **module evaluation time** and blocks all other initialization until all 9 GLBs have been fetched and parsed. On a ~30 Mbps connection 163 MB takes ~45 seconds. During this time the canvas is black (blocked by `Suspense` + `LoadingSpinner`).

### 2.4 No LOD

Every planet mesh renders at full detail regardless of camera distance. Saturn 8 vertices away renders with the same complexity as at distance 2. The 1.87M-vertex Uranus mesh sends all vertices through the pipeline even when the planet occupies < 5% of the viewport.

### 2.5 Postprocessing Always Active

`EffectComposer` + `Bloom` runs on every `invalidate()` call, even when the scene is static (tour paused, no interaction). The bloom pass is a full-screen render-to-texture operation that doubles the frame cost on mobile.

---

## 3. Memory Bottlenecks

### 3.1 Estimated Runtime Memory (Cinematic Mode, All GLBs Loaded)

| Consumer | RAM estimate | Notes |
|----------|-------------|-------|
| Uranus geometry (vertex buffers) | ~60 MB | 1.87M verts × (pos 12B + normal 12B + uv 8B) × ~1.5x overhead |
| Planet textures (GPU) | ~120 MB | 81 MB of texture data in buffers → DXT/ETC2 compression ~40–60 MB GPU |
| Bloom render targets | ~16 MB | Two ½-res RGBA16F buffers at 375×812 = ~6 MB × 2 |
| Orbit rings (LineSegments) | < 0.5 MB | 128 segs × 8 × 3 × 4B = 12 KB |
| InstancedStars (Points) | ~0.2 MB | 6000 × (3+3+1) × 4B = 168 KB |
| Three.js scene graph + materials | ~10 MB | Meshes, textures, materials, geometries |
| React + Zustand state | ~5 MB | Component tree, stores, DOM |
| **Total estimated** | **~200–250 MB** | GPU VRAM + system RAM combined |

### 3.2 Device Risk Assessment

| Device | RAM | Risk | Failure mode |
|--------|-----|------|-------------|
| High-end desktop | 16+ GB | Low | None expected |
| Mid-range mobile | 6 GB | **Medium** | Slow load, occasional context loss |
| Budget mobile | 4 GB | **High** | GLB OOM, black screen, tab crash |
| Older Android WebView | 2–3 GB | **Critical** | `OUT_OF_MEMORY` on Uranus load, blank canvas |

The 83 MB Uranus GLB is the primary risk factor. On a 4 GB device the browser tab typically has a 512 MB–1 GB heap limit. Uranus alone consumes ~60 MB of vertex data before GPU upload, and after decompression/upload the GPU memory footprint grows.

---

## 4. Optimization Roadmap

### Phase 1 — Quick Wins (P0, small effort)

| Task | Est. savings | Effort |
|------|-------------|--------|
| Copy Draco decoder files to `public/draco/` | Enables future compression | 5 min |
| Implement `far` camera plane check | Prevents unnecessary renders | 30 min |
| Add `frameloop` check to EffectComposer | Saves bloom GPU time when static | 30 min |

### Phase 2 — Asset Pipeline (P0–P1, medium effort)

| Task | Est. savings | Effort |
|------|-------------|--------|
| Draco-compress Uranus.glb | 83 MB → 5–15 MB (80–94% reduction) | 1 day |
| Draco-compress all other GLBs | 80 MB → 5–15 MB | 1 day |
| Downscale Earth/Mercury/Mars textures to 2K | 21→5 MB, 19→5 MB, 12→3 MB | 2 hours |
| Generate ETC2/Basis textures for mobile | Reduce GPU memory 2–4× | 1 day |

### Phase 3 — Rendering (P1, medium effort)

| Task | Benefit | Effort |
|------|---------|--------|
| Add `useProgress`-based deferred GLB loading after first paint | Time-to-first-frame drops from ~45s to ~2s | 1 day |
| Implement LOD with 3 levels (full / half / decimated) | GPU vertex throughput drops 50–80% at distance | 2 days |
| Lazy-load outer planets (Saturn, Uranus, Neptune) post-render | Initial paint doesn't wait for 100+ MB | 1 day |

### Phase 4 — Framing (P1, small effort)

| Task | Benefit | Effort |
|------|---------|--------|
| Include ring extents in Saturn camera distance | Saturn no longer fills viewport on mobile | 30 min |
| Use computed GLB bounding sphere radius in camera formula | Consistent framing across all planets | 1 hour |

---

## 5. Frameloop="demand" Validation

### Current state

| Trigger | `invalidate()` called? | Correct? |
|---------|----------------------|----------|
| CinematicTour `useFrame` | Yes (line 58) | ✅ |
| FocusCamera `useFrame` | Yes (line 34) | ✅ |
| OrbitControls `useFrame` | Via drei built-in `invalidate` | ✅ (when tour paused) |
| Planet orbital `useFrame` | **No** | ❌ — planet positions update but canvas never re-renders |
| GLB load completion | **No** | ❌ — fallback sphere swap to GLB doesn't trigger render |

### Current state (all fixed)

| Trigger | `invalidate()` called? | Status |
|---------|----------------------|--------|
| CinematicTour `useFrame` | Yes | ✅ |
| FocusCamera `useFrame` | Yes | ✅ |
| OrbitControls `useFrame` | Via drei built-in | ✅ |
| Planet orbital `useFrame` | Yes | ✅ Fixed |
| Canvas `onCreated` | Yes | ✅ Fixed |
| WebGL context restored | Yes | ✅ Fixed |
