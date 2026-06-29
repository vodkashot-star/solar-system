# Rendering Pipeline — CosmicVoyage

**Date:** 2026-06-22
**Updated:** 2026-06-28
**Version:** 1.2 (29 bodies, Draco deployed, computedRadii framing, loading timeout)

---

## 1. Scene Lifecycle

```
Page load
  │
  ▼
Canvas mount (SolarSystem.tsx)
  │
  ├─ color background (#02030a)
  ├─ ambientLight (0.08)
  ├─ pointLight (origin, intensity 3.5, distance 200)
  ├─ InstancedStars (6000 points, radius 200)
  ├─ OrbitRings (28 orbit paths, 128 segs each, color-coded by 6 categories via 6 LineSegments)
  ├─ Planets × 29 (each inside <Suspense>)
  │    ├─ FallbackSphere (immediate, colored sphere)
  │    └─ GLBModel (async — useGLTF loads from /models/*.glb via Draco)
  │
  ├─ FocusCamera (always mounted, runs useFrame when isFocused)
  ├─ CinematicTour (runs useFrame when enabled && !isFocused)
  ├─ OrbitControls (mounted only when !tourOn)
  │
  └─ EffectComposer
       └─ Bloom (intensity 0.9, luminanceThreshold 0.6)
```

### Critical path dependencies

1. **Canvas creation** — synchronous, blocks on WebGL context acquisition
2. **First paint** — fallback spheres render immediately via Suspense; no preload blocking
3. **Tour start** — must wait for planet position callbacks (positions ref populated in `useFrame`)
4. **GLB swap** — asynchronous per planet when `useGLTF` resolves; `invalidate()` triggered
5. **Focus/defocus** — zustand state change → `FocusCamera` lerps camera using `computedRadii`
6. **Loading overlay** — hides when `useProgress >= 100` or after 15s timeout

---

## 2. Asset Loading Pipeline

### 2.1 GLB Load Path

```
Asset JSON  ──►  bodies.ts  ──►  Planet.tsx
(.glb.asset.       (imports      (useGLTF(url))
 json: {url})       .url prop)     │
                                   ├─ DRACOLoader
                                   │    └─ /draco/draco_decoder.wasm  ✓ deployed
                                   │    └─ /draco/draco_decoder.js    ✓ deployed
                                   │
                                   └─ GLTFLoader (handles non-Draco fallback)
```

### 2.2 Load Strategy

- **No module-level preload** — the blocking `useGLTF.preload` loop was removed from `Planet.tsx`
- Each `useGLTF(url)` call inside `GLBModel` triggers fetch-on-render
- Fallback spheres render immediately; GLBs swap in asynchronously per planet
- `LoadingSpinner` shows `useProgress` and hides when `progress >= 100` **or after 15s timeout**
- 29 GLBs total (~95 MB) load progressively; no single stalled load can block forever

### 2.3 Asset JSON Indirection

```
client/src/assets/solar/<name>.glb.asset.json
  → {"url": "/models/<name>.glb"}
```

Swapping to a CDN only requires updating the JSON files — no code changes.

### 2.4 Draco Decoder

- Files deployed to `client/public/draco/`: `draco_decoder.wasm`, `draco_decoder.js`, `draco_wasm_wrapper.js`
- Copied from `node_modules/three/examples/jsm/libs/draco/` via `scripts/copy-draco.sh`
- `npm run build` runs the copy script automatically
- `initDracoDecoder()` in `draco-setup.ts` wires `DRACOLoader` into drei's `useGLTF` via type-asserted `useGLTF.setDRACOLoader(loader)`
- Called once in `App.tsx` `useEffect` before any GLB loads

---

## 3. Camera System

### 3.1 Camera Architecture

Three distinct camera controllers, mutually exclusive:

```
                     ┌─────────────────────────────┐
                     │   Zustand store             │
                     │   (camera-focus.ts)         │
                     │   isFocused: boolean         │
                     │   targetBodyId: string|null  │
                     │   targetPosition: Vector3    │
                     └──────────┬──────────────────┘
                                │
           ┌────────────────────┼────────────────────┐
           ▼                    ▼                    ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
   │ CinematicTour│   │ FocusCamera  │   │  OrbitControls   │
   │ (tour active)│   │ (isFocused)  │   │ (!tourOn)        │
   │ damp3 0.9    │   │ damp3 0.85   │   │ drei built-in    │
   └──────────────┘   └──────────────┘   └──────────────────┘
```

### 3.2 Camera Distance — computedRadii

Both `CinematicTour` and `FocusCamera` use a `computedRadii` ref populated by `Planet` after each GLB loads:

```ts
// Planet.tsx — after GLB loads
const box = new THREE.Box3().setFromObject(spin.current);
const size = new THREE.Vector3(); box.getSize(size);
const radius = Math.max(size.x, size.y, size.z) / 2;
onComputedRadius(body.id, radius);
```

Camera distance formulas use `computedRadii.current[body.id] ?? body.visualRadius`:
- **CinematicTour:** `dist = frameR * 4 + 3`
- **FocusCamera:** `dist = frameR * 5 + 5`

Saturn rings are included in the bounding box, so ring geometry is accounted for automatically.

### 3.3 Camera Configuration

```
position: [0, 18, 60]   far: 1500
fov: 50°                near: 0.1
dpr: [1, 1.75]
```

---

## 4. State Flow

```
SolarSystem.tsx (container)
  │
  ├─ Local state:
  │    tourOn: boolean
  │    active: Body
  │    scaleMode: "cinematic" | "realistic"
  │    contextLost: boolean
  │    aiCache: Record<string, AIAnalysis>
  │    positions: MutableRefObject<Record<string, Vector3>>
  │    computedRadii: MutableRefObject<Record<string, number>>
  │
  ├─ Zustand store (camera-focus.ts):
  │    targetBodyId, targetPosition, isFocused
  │    focus(bodyId, position) / clear()
  │
  └─ Props to children:
       Planet ← body, onPosition, scaleMultiplier, onComputedRadius
       OrbitRings ← scaleMultiplier
       CinematicTour ← enabled, onActiveChange, positions, computedRadii
       FocusCamera ← computedRadii
```

---

## 5. Render Flow

### 5.1 Frame pipeline (each render)

```
1. Three.js scene graph traversal
   ├─ InstancedStars (1 draw call, 6000 points)
   ├─ OrbitRings (6 draw calls — one per body type, color-coded)
   ├─ Planet × 29
   │    ├─ SaturnRings (Saturn only, via hasRings flag)
   │    └─ GLBModel meshes
   └─ pointLight at origin

2. R3F reconciler: matrix + rotation updates

3. EffectComposer
   └─ Bloom (full-screen, intensity 0.9)

4. Buffer swap → display
```

### 5.2 Draw call estimate

| Object | Draw calls | Notes |
|--------|-----------|-------|
| InstancedStars | 1 | Single Points |
| OrbitRings | 6 | One per body category |
| Sun | 2 | Two meshes |
| 8 planets (approx) | ~20 | Varies per GLB |
| 20 small bodies | ~20 | Most are 1 mesh each |
| **Total** | **~50** | Within mobile budget |

---

## 6. frameloop="demand" Validation

Every code path that mutates the scene calls `state.invalidate()`:

| Trigger | `invalidate()` | Status |
|---------|---------------|--------|
| CinematicTour `useFrame` | Yes | ✅ |
| FocusCamera `useFrame` | Yes | ✅ |
| Planet orbital `useFrame` | Yes | ✅ (added in P0 fixes) |
| OrbitControls | Via drei built-in | ✅ |
| Canvas `onCreated` | Yes (initial frame) | ✅ |
| WebGL context restored | Yes | ✅ |

---

## 7. Context Loss Recovery

`SolarSystem.tsx` `onCreated` registers listeners on the canvas element:

```ts
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  setContextLost(true);
});
canvas.addEventListener('webglcontextrestored', () => {
  setContextLost(false);
  state.invalidate();
});
```

When `contextLost=true`, a recovery overlay is shown. Auto-resolves on `webglcontextrestored`; manual "Reload page" fallback provided.

---

## 8. Body Categories & Orbit Ring Colors

`bodies.ts` defines 6 body types with corresponding orbit ring colors:

| Type | Color | Bodies |
|------|-------|--------|
| `star` | `#ffd700` | Sun |
| `planet` | `#4fc3f7` | 8 planets |
| `dwarfPlanet` | `#ffb74d` | Pluto, Ceres, Eris, Haumea, Makemake, Gonggong, Orcus |
| `asteroid` | `#9e9e9e` | Vesta, Pallas, Juno, Hygiea, Astraea, Apophis, Bennu, Itokawa, Eros, Psyche, Varda |
| `comet` | `#66bb6a` | Halley |
| `interstellar` | `#ce93d8` | Oumuamua |

`OrbitRings.tsx` renders 6 `LineSegments` (one per category), each with its category color.

---

## 9. SpaceAI Integration

`SolarSystem.tsx` fetches AI classification for the active body via the Express proxy:

```
GET /api/ai/classify/:bodyId?orbital_period=&axial_tilt=&mass=&radius=&eccentricity=
  → proxied to http://localhost:8000/classify/:bodyId
  → returns AIAnalysis JSON (classification, confidence, alternatives, features, similarObjects)
```

Results cached in `aiCache` state. If the FastAPI service is offline (`:8000` unreachable), the proxy returns `503` and the app fails silently — no AI panel is shown.

Start the full stack (Express + FastAPI) with: `bash scripts/dev.sh`
