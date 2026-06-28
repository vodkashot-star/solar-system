# Rendering Pipeline — CosmicVoyage

**Date:** 2026-06-22
**Version:** 1.1 (updated for 30-body extension)

---

## 1. Scene Lifecycle

```
Page load
  │
  ▼
Canvas mount (SolarSystem.tsx:42-70)
  │
  ├─ color background (#02030a)
  ├─ ambientLight (0.08)
  ├─ pointLight (origin, intensity 3.5, distance 200)
  ├─ InstancedStars (6000 points, radius 200)
  ├─ OrbitRings (29 orbit paths, 128 segs each, color-coded by 6 categories via 6 LineSegments)
  ├─ Planets × 29 (suspended, each inside <Suspense>)
  │    │
  │    ├─ FallbackSphere (immediate, colored sphere)
  │    └─ GLBModel (async — useGLTF loads from /models/*.glb)
  │
  ├─ FocusCamera (always mounted, runs useFrame when isFocused)
  ├─ CinematicTour (mounted, runs useFrame when enabled && !isFocused)
  ├─ OrbitControls (mounted only when !tourOn)
  │
  └─ EffectComposer
       └─ Bloom (intensity 0.9, luminanceThreshold 0.6)
```

### Critical path dependencies

1. **Canvas creation** — synchronous, blocks on WebGL context acquisition
2. **First paint** — requires at least one planet to resolve from Suspense (or all fallbacks)
3. **Tour start** — must wait for planet position callbacks to fire (positions ref populated in `useFrame`)
4. **GLB swap** — occurs asynchronously per planet when `useGLTF` resolves
5. **Focus/defocus** — zustand state change → `FocusCamera` lerps camera

---

## 2. Asset Loading Pipeline

### 2.1 GLB Load Path

```
Asset JSON  ──►  bodies.ts  ──►  Planet.tsx
(e.g.,            (imports      (useGLTF(url))
 sun.glb.         .url prop)     │
 asset.json)                     ├─ DracoLoader (if compressed)
                                 │    └─ /draco/draco_decoder.wasm
                                 │       └─ ❌ NOT DEPLOYED
                                 │
                                 └─ GLTFLoader (uncompressed fallback)
                                      └─ ✓ works for all current GLBs
```

### 2.2 Preload Strategy (Problematic)

```ts
// Planet.tsx:16-18 — module-level, synchronous
for (const b of BODIES) {
  if (b.glbUrl) useGLTF.preload(b.glbUrl);
}
```

- **~~All 9 GLBs start fetching at module import time~~** — **REMOVED**: preload loop deleted from `Planet.tsx`
- **~~163 MB total must be downloaded before first paint~~** — **REMOVED**: GLBs load on-demand per `<Suspense>` boundary
- Fallback spheres render immediately; GLBs swap in asynchronously when `useGLTF` resolves
- `LoadingSpinner` shows `useProgress` as GLBs load individually (not all at once)
- 29 GLBs total (~95 MB after Uranus optimization) load progressively

### 2.3 Asset JSON Indirection

Each GLB has a corresponding `.asset.json` file:

```
client/src/assets/solar/<name>.glb.asset.json
  → {"url": "/models/<name>.glb"}
```

This allows CDN path swapping without code changes. Currently points to local `/models/` paths. If a CDN switch were needed, only the JSON files would change.

### 2.4 Draco Decoder (Broken)

`draco-setup.ts` initializes a `DRACOLoader` with decoder path `/draco/`. However:

- `client/public/draco/` contains only `README.md`
- Decoder files exist in `node_modules/three/examples/jsm/libs/draco/` (703 KB JS, 280 KB WASM, 58 KB wrapper)
- **They are not copied to public** — when useGLTF encounters a Draco-compressed GLB, loader initialisation succeeds but decoder file fetch 404s
- Current GLBs are all uncompressed, so this code path is never exercised — it's a **latent P0 bug**

**Decoupling issue:** `initDracoDecoder()` in `draco-setup.ts` creates a singleton `DRACOLoader`, but this loader is **never passed to `useGLTF`**. drei's `useGLTF` has its own internal loader setup. The custom Draco loader in `draco-setup.ts` is effectively **dead code** — it's initialized but never injected into the GLTF loading pipeline.

---

## 3. Camera System

### 3.1 Camera Architecture

Three distinct camera controllers, mutually exclusive:

```
                     ┌─────────────────────────────┐
                     │   Zustand store             │
                     │   (camera-focus.ts)         │
                     │   isFocused: boolean         │
                     │   targetBodyId: string|null   │
                     │   targetPosition: Vector3    │
                     └──────────┬──────────────────┘
                                │
           ┌────────────────────┼────────────────────┐
           │                    │                    │
           ▼                    ▼                    ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
   │ CinematicTour│   │ FocusCamera  │   │  OrbitControls   │
   │ (tour active)│   │ (isFocused)  │   │ (!tourOn)        │
   │              │   │              │   │                  │
   │ damp3 lerp  │   │ damp3 lerp  │   │ drei built-in    │
   │ 0.9 factor   │   │ 0.85 factor  │   │ damping          │
   └──────────────┘   └──────────────┘   └──────────────────┘
```

### 3.2 CinematicTour (CinematicTour.tsx)

**State machine:**
- Cycles through `BODIES[]` every `SECONDS_PER_BODY * BODIES.length` seconds
- Each body gets `SECONDS_PER_BODY = 7` seconds
- Arc trajectory: camera sweeps around the body on a horizontal arc of `1.2π` radians at a fixed distance

**Camera distance calculation (line 43):**
```ts
const dist = body.visualRadius * 4 + 3;
const height = body.visualRadius * 1.2 + 1.5;
```

**Limitation:** Does not account for extended geometry:
- Saturn's rings (extend to ~8.66 units, but `visualRadius` is 1.9)
- Uranus's irregular bounding box (31 meshes with various extents)
- Any body's `framingRadius` property — doesn't exist

**Interpolation:** `damp3(camera.position, targetPos.current, 0.9, delta)` — exponential ease with factor 0.9.

### 3.3 FocusCamera (FocusCamera.tsx)

**Trigger:** User clicks on a planet → `handleClick` in `Planet.tsx:106-113` → zustand `focus(bodyId, position)` → `isFocused=true` → FocusCamera activates.

**Camera distance calculation (line 20):**
```ts
const dist = body.visualRadius * 5 + 5;
const height = body.visualRadius * 0.8 + 2;
```

Slightly more zoomed out than CinematicTour (`*5 + 5` vs `*4 + 3`).

**Reset:** User clicks "Resume tour" button → `clearFocus()` → `isFocused=false` → FocusCamera stops, CinematicTour resumes (with elapsed time accumulated during focus).

### 3.4 OrbitControls (Drei)

- Mounted only when `tourOn === false` (line 63-65)
- `enableDamping` — smooth inertia on user interaction
- **Not unmounted when tour resumes** — simply stays in the tree but `tourOn=true` hides it via conditional rendering. However, OrbitControls is conditionally mounted, so when tour resumes it's unmounted, which is correct.
- When tour resumes after OrbitControls usage, camera position is where the user left it — CinematicTour takes over from that position and lerps to the current body.

### 3.5 Camera Configuration

```
Camera:  position [0, 12, 38]
         FOV 55°
         near 0.1
         far 1000
         DPR [1, 1.75]
```

---

## 4. State Flow

```
SolarSystem.tsx (container)
  │
  ├─ Local state:
  │    tourOn: boolean (starts true)
  │    active: Body (starts BODIES[0])
  │    scaleMode: "cinematic" | "realistic" (starts "cinematic")
  │    positions: MutableRefObject<Record<string, Vector3>>
  │
  ├─ Zustand store (camera-focus.ts):
  │    targetBodyId: string | null
  │    targetPosition: Vector3
  │    isFocused: boolean
  │    focus(bodyId, position) — setter
  │    clear() — resets isFocused
  │
  └─ Props to children:
       Planet ← body, onPosition callback, scaleMultiplier
       OrbitRings ← scaleMultiplier
       CinematicTour ← enabled (tourOn), onActiveChange, positions
       FocusCamera ← (reads zustand directly)
```

### State change → render flow

1. **Scale toggle:** `setScaleMode` → `scaleMultiplier` recomputed → all `Planet` and `OrbitRings` re-render with new multiplier → `invalidate()` via tour/focus `useFrame`
2. **Click to focus:** `handleClick` → zustand `focus()` → `FocusCamera` `useEffect` calculates target → `useFrame` lerps camera → `invalidate()`
3. **Tour progress:** `useFrame` in `CinematicTour` → `currentIndex` changes → `onActiveChange` → `active` state updates → HUD re-renders
4. **Orbit update:** `useFrame` in `Planet` → position changes → `onPosition` callback → `positions.current` updated for CinematicTour

---

## 5. Render Flow

### 5.1 Frame pipeline (each render)

```
1. Three.js scene graph traversal
   ├─ InstancedStars (single draw call, 6000 points)
   ├─ OrbitRings (single draw call, 8 orbit paths via LineSegments)
   ├─ Planet × 9
   │    ├─ SaturnRings (extra mesh for Saturn only)
   │    ├─ GLBModel meshes (variable count)
   │    │    └─ With frustumCulled=true (per-mesh)
   │    └─ FallbackSphere (hidden once GLB loaded)
   └─ pointLight (sun-origin, dynamic lighting)

2. R3F fiber reconciler updates
   ├─ Matrix updates for planet positions (pivot group)
   ├─ Rotation updates for planet spin (spin group)
   └─ Camera transform updates (from damp3 lerps)

3. EffectComposer post-processing
   └─ Bloom pass (full-screen blur + blend)

4. Swap buffer → display
```

### 5.2 Draw call estimate

| Object | Meshes | Draw calls | Notes |
|--------|--------|-----------|-------|
| InstancedStars | 1 | 1 | Single Points |
| OrbitRings | 1 | 1 | Single LineSegments |
| Sun GLB | 2 | 2 | Two meshes |
| Mercury GLB | 1 | 1 | |
| Venus GLB | 1 | 1 | |
| Earth GLB | 1 | 1 | |
| Mars GLB | 1 | 1 | |
| Jupiter GLB | 1 | 1 | |
| Saturn GLB | 8 | 8 | Plus 1 for SaturnRings |
| Uranus GLB | 31 | 31 | Dominates draw calls |
| Neptune GLB | 2 | 2 | |
| **Total** | **~51** | **~51** | |

For comparison, budget recommended for mobile is ~30–50 draw calls. Uranus alone uses 31.

---

## 6. Interaction Flow

### 6.1 Click → Focus

```
User clicks planet
  │
  ▼
handleClick (Planet.tsx:106-113)
  ├─ e.stopPropagation() — prevents Canvas click-through
  ├─ pivot.current.position — gets current world position
  └─ focus(body.id, position)
       │
       ▼
zustand store → isFocused=true, targetBodyId, targetPosition
       │
       ▼
FocusCamera useEffect (FocusCamera.tsx:15-26)
  ├─ finds body config from BODIES[]
  ├─ calculates flyTarget: visualRadius * 5 + 5
  └─ sets lookTarget to body position
       │
       ▼
FocusCamera useFrame (FocusCamera.tsx:28-35)
  ├─ damp3(camera.position → flyTarget, 0.85)
  ├─ damp3(lookCurrent → lookTarget, 0.85)
  ├─ camera.lookAt(lookCurrent)
  └─ invalidate()
```

### 6.2 Tour Pause → OrbitControls

```
User clicks "Pause tour"
  │
  ▼
setTourOn(false) (SolarSystem.tsx:89-93)
  ├─ If previously paused → clearFocus() (zustand)
  └─ Conditional render: OrbitControls mounts
       │
       ▼
CinematicTour stops (enabled=false → useFrame returns early)
  │
  ▼
User can orbit/pan/zoom with mouse/touch
  │
  ▼
User clicks "Resume tour"
  │
  ▼
setTourOn(true)
  ├─ OrbitControls unmounts
  └─ CinematicTour resumes from elapsed time
```

### 6.3 Scale Mode Toggle

```
User clicks "REALISTIC"/"CINEMATIC" button
  │
  ▼
setScaleMode (SolarSystem.tsx:36-39)
  │
  ▼
scaleMultiplier: cinematic=1, realistic=0.25
  │
  ├─ Planet receives new scaleMultiplier
  │    └─ effectiveOrbit = body.orbit * scaleMultiplier
  │    └─ effectiveRadius = body.visualRadius * (0.3 + 0.7 * scaleMultiplier)
  │         └─ realistic: effectiveRadius = visualRadius * 0.475
  │
  ├─ OrbitRings receives new scaleMultiplier
  │    └─ radius = body.orbit * scaleMultiplier
  │
  └─ (Camera position NOT adjusted — same orbit path but planets are smaller/closer)
```

---

## 7. Performance-Critical Paths

### 7.1 GLB Load & Parse (highest cost)

| Step | Time (estimate) | Notes |
|------|-----------------|-------|
| Network fetch 163 MB | 10–45 s | Depends on connection |
| GLB binary parse | 0.5–5 s | Single-threaded JSON chunk + buffer view setup |
| Texture decode (GPU upload) | 1–3 s | ~81 MB texture data → GPU format |
| Draco decode | N/A | Not currently used — would add CPU time but reduce network |
| Geometry buffer upload | 0.5–2 s | 1.87M verts for Uranus dominates |
| Material initialisation | 0.1–0.5 s | PBR material setup |

**Hot path:** `GLBModel.tsx:27-50` — `Box3.setFromObject()` on Uranus takes ~50–100 ms alone (1.87M verts). This runs inside `useMemo` so it's one-time, but it blocks the main thread during mount.

### 7.2 Camera Lerp (per frame)

`damp3` from maath is a simple exponential ease — cheap, ~1–2 µs per call. Not a bottleneck.

### 7.3 Bloom Post-Processing (per frame)

Full-screen effect. On mobile at 375×812 with DPR 1.75 → ~664×1436 → ~1.9M pixels. Two render targets at half resolution. Blum blur samples ~20–40 texels per pixel. Estimated GPU cost: **2–4 ms per frame** on mobile, ~15–25% of frame budget at 30 fps.

### 7.4 Planet Orbit Update (per frame)

`Planet.tsx:115-127` — per-planet `useFrame`:
- 2 trig calls (cos, sin) for orbit position
- 1 rotation increment
- 1 onPosition callback (ref write)
- **~0.5 µs per planet** — negligible

### 7.5 Draw Call Cost (per frame)

~51 draw calls total. Uranus contributes 31 (60%). Each draw call has ~2–5 µs CPU overhead + GPU setup cost. At 30 fps, 51 draw calls is acceptable but close to mobile thresholds (60+ can cause frame drops).

---

## 8. Data Flow Diagram

```
┌─────────────┐     ┌────────────────┐     ┌──────────────┐
│  bodies.ts  │────►│  Planet.tsx    │────►│  Three.js    │
│  (config)   │     │  (position,    │     │  Scene Graph │
│             │     │   rotation,    │     │              │
│  visualR    │     │   GLB load)    │     │  51 meshes   │
│  orbit      │     │                │     │  1 point     │
│  orbitSpeed │     │  onPosition    │     │  1 lineseg   │
│  glbUrl     │     │  callback ─────┼──┐  │              │
└─────────────┘     └────────────────┘  │  └──────────────┘
                                        │         ▲
┌─────────────┐     ┌────────────────┐  │         │
│  zustand    │     │  CinematicTour │  │  invalidate()
│  camera-    │     │  reads pos     │◄─┘         │
│  focus.ts   │     │  ref + body    │            │
│             │     │  visualRadius  │     ┌──────┴──────┐
│  isFocused  │◄────│  → calc dist   │     │  R3F Canvas │
│  targetBody │     │  → damp3       │     │  (frameloop │
│  targetPos  │     └────────────────┘     │   = demand) │
│             │                            │             │
│  focus()    │────►┌────────────────┐     │  EffectComp │
│  clear()    │     │  FocusCamera   │     │  → Bloom    │
└─────────────┘     │  same calc as  │     └─────────────┘
                    │  CinematicTour │
                    │  + damp3 0.85  │
                    └────────────────┘
```
