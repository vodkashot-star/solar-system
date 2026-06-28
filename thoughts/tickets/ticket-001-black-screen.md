---
status: implemented
priority: P0
reported: 2026-06-22
component: Canvas rendering + GLB loading pipeline
plan: thoughts/plans/p0-black-screen-fixes.md
---

# Ticket-001: Black Screen / Invisible Planets

---

## Root-Cause Matrix

| # | Symptom | Root Cause | Files | Severity | Reproduction |
|---|---------|-----------|-------|----------|--------------|
| 1 | Entire canvas black, never renders | `frameloop="demand"` with no `invalidate()` trigger during initial mount | `SolarSystem.tsx:46`, `Planet.tsx:115-127` | **Critical** | Load on mobile with slow connection; GLB load completes but Suspense fallback never transitions |
| 2 | Canvas black on mobile only | WebGL context lost due to 83 MB Uranus GLB + 1.87M verts exceeding GPU heap | `public/models/uranus.glb` | **Critical** | Any 4 GB device; consistently fails on older Android WebViews |
| 3 | Canvas black, console `WebGL: CONTEXT_LOST_WARNING` | Missing Draco decoder WASM (`public/draco/` has only README.md), but GLBs aren't Draco-compressed — sees unrelated WebGL error | `public/draco/`, `draco-setup.ts:10` | **High** | Would occur if any GLB used Draco extension. Currently latent. |
| 4 | Loading spinner spins forever, canvas stays black | `useProgress` (drei) never reaches 100% because GLB load fails silently — `useGLTF` error not propagated to Suspense boundary | `Planet.tsx:134` | **High** | On slow/mobile when Uranus fails, Suspense fallback stays visible |
| 5 | Planets not visible after tour starts | Camera position/reset not triggered when tour begins; CinematicTour skips first-frame invalidate if `elapsed.current < delta` | `CinematicTour.tsx:27-59` | **Medium** | Rare — race on startup when `enabled=true` before first `useFrame` |
| 6 | Saturn/Uranus appear giant, filling mobile viewport | Camera distance formula `visualRadius * 4 + 3` ignores Saturn's ring geometry (extends 8.66 units vs 1.9 unit radius) and Uranus's actual bounding box | `CinematicTour.tsx:43`, `FocusCamera.tsx:20` | **High** | Every mobile session during Saturn/Uranus tour segment |
| 7 | Planets frozen after tour paused | `Planet.tsx` `useFrame` updates positions without calling `invalidate()`; OrbitControls only triggers `invalidate` on user interaction | `Planet.tsx:115-127` | **Medium** | Pause tour, observe planets — they stop orbiting |
| 8 | Fallback sphere shown permanently, GLB never appears | `Suspense` boundary in `Planet.tsx:134` — if GLB fails to parse, `useGLTF` throws and Suspense shows the fallback forever with no error recovery | `Planet.tsx:22-53` | **Medium** | If any GLB file is corrupted or server returns 404 |
| 9 | Scene renders but black on certain device orientations | `dpr={[1, 1.75]}` combined with `powerPreference: "high-performance"` — some mobile GPUs crash on high-DPR with large geometry + bloom | `SolarSystem.tsx:44-45` | **Low** | Specific to Mali GPUs at ~2× DPR |

---

## Severity Ranking

| Rank | Symptom | Priority | Likelihood | Mobile only? |
|------|---------|----------|------------|-------------|
| 1 | Uranus OOM → context loss → black screen | **P0** | High on 4 GB devices | Yes |
| 2 | Loading spinner forever → black screen | **P0** | Medium | Yes |
| 3 | Saturn/Uranus fill viewport (visual bug, not black) | **P1** | Every mobile session | Yes |
| 4 | Planets frozen after tour pause | **P2** | Every session | No |
| 5 | Fallback sphere never transitions to GLB | **P2** | Low | No |
| 6 | Canvas black, never renders first frame | **P0** | Low (race condition) | No |
| 7 | Draco decoder missing (latent) | **P1** | Low (would be P0 if activated) | No |

---

## Reproduction Scenarios

### Scenario A: Mobile 4 GB, cellular connection
1. Open app on iPhone 11 or Galaxy A-series
2. All 9 GLBs (163 MB total) begin loading
3. `useGLTF.preload` at module level blocks first paint
4. Loading spinner displays for 30–60 seconds
5. Uranus.glb (83 MB) starts parsing → GPU heap exhausted
6. WebGL context lost → entire canvas turns black
7. Loading spinner disappears (`useProgress` detects error or times out)
8. User sees only the HUD UI over a black canvas

### Scenario B: Saturn tour segment on mobile
1. Tour progresses to Saturn (index 6)
2. Camera distance = `1.9 * 4 + 3` = 10.6 units
3. Saturn rings span 8.66 units (inner 5.47, outer 8.66)
4. Angular size of rings from camera: ~78% of viewport height at FOV 55°
5. On narrow mobile viewport (375×812), rings fill >80% of the screen
6. Only the innermost ring area is visible, planet body off-screen

### Scenario C: Tour paused then resumed
1. Tap "Pause tour"
2. `OrbitControls` mounts, camera stops receiving CinematicTour updates
3. Planet orbits continue (position updates in `Planet.tsx` `useFrame`) but `invalidate()` never called
4. User sees frozen planets despite their positions changing every frame
5. Tap "Resume tour" — camera snaps to current body position (time jump)

---

## Recommended Fixes

### Fix 1: Uranus GLB optimization (P0)

**Problem:** 83 MB, 1.87M verts, 31 meshes, no Draco compression.

**Solution:**
1. Draco-compress `uranus.glb`: `gltf-transform draco uranus.glb uranus-draco.glb --method edgebreaker --quantization-position 14 --quantization-normal 10 --quantization-uv 12`
2. Estimated size: 83 MB → ~8–15 MB (85–90% reduction)
3. Downsample any 4K+ textures to 2K (4.4 MB texture buffer → ~1.5 MB)
4. If procedural detail is needed, decimate mesh to ≤200K vertices (90% reduction) with normal-map baking

**Effort:** Large (requires 3D asset pipeline + script regeneration)

### Fix 2: Include ring extents in camera distance (P1)

**Problem:** `CinematicTour.tsx:43` and `FocusCamera.tsx:20` use `visualRadius` only, ignoring Saturn's rings.

**Solution:** Add a `framingRadius` override to Bodies config:

```ts
// bodies.ts
export type Body = {
  // ...existing fields
  framingRadius?: number; // overrides visualRadius for camera distance
};

// Saturn entry:
framingRadius: 8.66, // outer ring extent = visualRadius * 1.2 * 3.8
```

```ts
// CinematicTour.tsx
const frameR = body.framingRadius ?? body.visualRadius;
const dist = frameR * 4 + 3;
```

```ts
// FocusCamera.tsx
const frameR = body.framingRadius ?? body.visualRadius;
const dist = frameR * 5 + 5;
```

**Effort:** Small

### Fix 3: Deploy Draco decoder files (P0)

**Problem:** `public/draco/` has only README.md; decoder WASM/JS in `node_modules/three/examples/jsm/libs/draco/` not deployed.

**Solution:**
```bash
cp node_modules/three/examples/jsm/libs/draco/draco_decoder.wasm client/public/draco/
cp node_modules/three/examples/jsm/libs/draco/draco_decoder.js client/public/draco/
cp node_modules/three/examples/jsm/libs/draco/draco_wasm_wrapper.js client/public/draco/
```

Add a Vite plugin or build script to automate this on `npm run build`.

**Effort:** Small

### Fix 4: Lazy-load outer planets (P0)

**Problem:** `useGLTF.preload` at module level for all 9 GLBs blocks first paint for 163 MB.

**Solution:** Remove the module-level preload loop. Use `Suspense` with a per-planet `lazy` import, and prioritize inner planets first:

```ts
// Planet.tsx — remove lines 16-18
// Instead, load GLBs on demand via Suspense (already set up)
// Optionally add priority loading order
```

**Effort:** Medium

### Fix 5: Add `invalidate()` to planet `useFrame` (P2)

**Problem:** Planet positions update every frame but canvas never re-renders when tour is paused.

**Solution:**
```ts
// Planet.tsx — inside useFrame
state.invalidate(); // at end of useFrame callback
```

**Effort:** Small

### Fix 6: Graceful WebGL context loss handling (P0)

**Problem:** No context loss event listener or recovery.

**Solution:**
```tsx
// SolarSystem.tsx
<Canvas
  onCreated={({ gl }) => {
    gl.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('[WebGL] Context lost — attempting restart');
      setTimeout(() => gl.forceContextRestore(), 1000);
    });
  }}
  ...
>
```

**Effort:** Small

### Fix 7: Add `matrixAutoUpdate = false` guard (P2)

**Problem:** `Planet.tsx:44` sets `matrixAutoUpdate = false` on all meshes after centroid adjustment, but the centroid subtraction changes world positions while `matrixAutoUpdate` is off — the matrix won't reflect the centroid offset.

**Solution:** Set `matrixAutoUpdate = false` *only after* calling `updateMatrix()` (already done at line 45), or skip the `matrixAutoUpdate` optimization entirely — it's negligible with 31 meshes.

**Effort:** Small

---

## Verification Checklist

- [ ] App renders on iPhone SE (3 GB) without black screen
- [ ] App renders on Galaxy A52 (4 GB) without black screen
- [ ] Loading spinner visible for < 10 seconds on 50 Mbps connection
- [ ] Saturn tour segment: rings fit within viewport on 375 px wide screen
- [ ] Uranus tour segment: planet body visible, not clipped
- [ ] Tour pause → planets continue orbiting (visually)
- [ ] Tour resume → smooth transition, no time jump
- [ ] GLB load failure shows error in DebugPanel, not black screen
- [ ] WebGL context loss shows recovery attempt, not permanent black screen
- [ ] `npm run check` passes with no new TS errors
