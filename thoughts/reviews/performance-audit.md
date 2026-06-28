# Performance Audit — CosmicVoyage

**Date:** 2026-06-22
**Scope:** R3F solar system single-page app
**Auditor:** OpenCode

---

## Executive Summary

The app has a fundamentally sound architecture (`frameloop="demand"`, zustand stores, asset JSON indirection) but ships **163 MB of uncompressed GLB geometry** that gets fully loaded on page start. Two issues dominate the performance profile: (1) `uranus.glb` is a 83 MB outlier with 1.87M unoptimized vertices — 400× more complex than the median planet — and (2) Draco decoder files are absent from `public/draco/`, so no GLB uses compression despite the loading pipeline expecting it. On 4–6 GB mobile devices the app is at high risk of OOM kills, WebGL context loss, or black-screen failures.

---

## 1. Ranked Findings

| # | Finding | Impact | Effort | Priority | File(s) |
|---|---------|--------|--------|----------|---------|
| 1 | `uranus.glb` — 83 MB, 1.87M verts, 31 meshes (uncompressed) | Critical | Large | **P0** | `public/models/uranus.glb` |
| 2 | Draco decoder WASM/JS not deployed to `public/draco/` | Critical | Small | **P0** | `public/draco/` (only README.md) |
| 3 | All 9 GLBs preloaded synchronously at module import time | High | Medium | **P1** | `Planet.tsx:16-18` |
| 4 | Saturn ring visual radius excluded from camera distance formula | High | Small | **P1** | `CinematicTour.tsx:43`, `FocusCamera.tsx:20` |
| 5 | Earth & Mercury texture payload dominates file size (~21 MB / ~19 MB each) | High | Medium | **P1** | `public/models/earth.glb`, `mercury.glb` |
| 6 | No LOD system — full-resolution meshes rendered at any distance | High | Large | **P1** | `Planet.tsx` |
| 7 | `matrixAutoUpdate = false` applied inconsistently after centroid shift | Medium | Small | **P2** | `Planet.tsx:44` |
| 8 | Bloom postprocessing runs even when tour is paused | Medium | Small | **P2** | `SolarSystem.tsx:67-69` |
| 9 | `OrbitControls` not unmounted when tour resumes (zombie listener) | Medium | Small | **P2** | `SolarSystem.tsx:63-65` |
| 10 | `InstancedStars` re-creates geometry on every prop change | Low | Small | **P3** | `InstancedStars.tsx:33-63` |
| 11 | 6000 star points use `PointsMaterial` with `AdditiveBlending` (fill-rate) | Low | Small | **P3** | `InstancedStars.tsx:66-76` |

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

### Issues found

1. **Planet orbit animation doesn't invalidate.** `useFrame` in `Planet.tsx:115-127` updates positions and rotations but never calls `invalidate()`. When the tour is paused and OrbitControls are active, planet positions are stale until the user interacts (which triggers OrbitControls' own `invalidate`). Planets appear frozen.
2. **GLB load → swap invisible.** When `Suspense` resolves and a `FallbackSphere` is replaced by a `GLBModel`, no `invalidate()` fires. The canvas stays on the fallback frame until the next animation trigger.
3. **CinematicTour stops invalidating when `isFocused` is true** (line 28). Good — this is intentional. But when focus is cleared, the tour resumes. If `elapsed` hasn't been tracked during focus, a time jump occurs.

### Recommendation

Add `invalidate()` to `Planet.tsx`'s `useFrame`. This ensures planets animate even when the tour is paused.

```ts
// Planet.tsx — inside useFrame
if (onPosition) onPosition(p.position);
state.invalidate(); // <-- add
```
