# CosmicVoyage — Code Audit
**Date:** 2026-07-02  
**Scope:** Full source audit of `client/src/`, `server/`, `shared/`, `spaceAI/`  
**TypeScript check:** `npm run check` passes with 0 errors (excluding known `shared/schema.ts` drizzle issue)

---

## Severity Legend

| Label | Meaning |
|-------|---------|
| 🔴 Bug | Causes incorrect behavior at runtime |
| 🟠 Risk | Security or data-integrity concern |
| 🟡 Minor | Wasteful / incorrect but not breaking |
| 🔵 Smell | Code quality, maintainability |
| ⚪ Info | Known / documented, no action needed |

---

## 1 · Runtime Bugs

### 🔴 BUG-01 — `InstancedStars` missing `invalidate()` — stars freeze

**File:** `client/src/components/solar-system/InstancedStars.tsx`

The canvas uses `frameloop="demand"`. Every `useFrame` that drives animation **must** call `state.invalidate()` or Three.js stops rendering. `InstancedStars` mutates `rotation.y` and `uTime` each frame but never invalidates, so the star field and twinkle animation silently stall as soon as nothing else triggers a render (e.g. when the tour is paused).

```ts
// current — broken
useFrame((_state, delta) => {
  uniformsRef.current.uTime.value += delta;
  if (meshRef.current) meshRef.current.rotation.y += delta * 0.001;
  // ← state.invalidate() missing
});

// fix
useFrame((state, delta) => {
  uniformsRef.current.uTime.value += delta;
  if (meshRef.current) meshRef.current.rotation.y += delta * 0.001;
  state.invalidate();
});
```

---

### 🔴 BUG-02 — `FocusCamera` flies to stale position

**File:** `client/src/components/solar-system/FocusCamera.tsx`

`flyTarget` and `lookTarget` are set once inside a `useEffect` that fires when `targetPosition` changes. `targetPosition` is a snapshot clone taken at click time (see `camera-focus.ts` store). Planets continue orbiting, so after ~1 second the camera is aimed at where the planet *was*.

`CinematicTour` correctly reads `positions.current[body.id]` **every frame** inside `useFrame`. `FocusCamera` needs to do the same.

```ts
// current — flies to stale snapshot
useEffect(() => {
  if (isFocused && targetBodyId) {
    const bodyPos = targetPosition; // ← snapshot, planet has moved
    flyTarget.current.set(bodyPos.x + dist, ...);
  }
}, [isFocused, targetBodyId, targetPosition, computedRadii]);

// fix — pass a live `positions` ref and update every frame
useFrame((_, delta) => {
  if (!isFocused || !targetBodyId) return;
  const livePos = positions.current[targetBodyId] ?? lookTarget.current;
  lookTarget.current.copy(livePos);
  const frameR = computedRadii.current[targetBodyId] ?? 1;
  flyTarget.current.set(livePos.x + frameR * 5 + 5, ...);
  damp3(camera.position, flyTarget.current, 0.85, delta);
  damp3(lookCurrent.current, lookTarget.current, 0.85, delta);
  camera.lookAt(lookCurrent.current);
  invalidate();
});
```

`FocusCamera` needs to receive `positions: React.MutableRefObject<Record<string, THREE.Vector3>>` as a prop (already available in `SolarSystem.tsx`).

---

### 🔴 BUG-03 — Side effect inside `useMemo` in `GLBModel`

**File:** `client/src/components/solar-system/Planet.tsx` — `GLBModel` component

`startLoad(body.id, body.name, url)` is called inside a `useMemo`. `useMemo` is a pure computation hook; React may invoke it multiple times in Strict Mode or concurrent rendering, causing duplicate load entries and incorrect loading-state tracking.

```ts
// current — side effect in useMemo
useMemo(() => {
  startLoad(body.id, body.name, url); // ← side effect
  ...
}, [scene, radius]);

// fix — move to useEffect
useEffect(() => {
  startLoad(body.id, body.name, url);
}, [body.id, body.name, url]);
```

---

## 2 · Security

### 🟠 SEC-01 — Wildcard CORS on the Express server

**File:** `server/app.ts`

```ts
res.header('Access-Control-Allow-Origin', '*');
res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
```

This allows any origin to make credentialed requests to the `/api/ai/classify/:bodyId` proxy. In production this should be locked to the actual domain. The `Authorization` header being allowed in CORS preflight is especially unnecessary given this is a read-only public API.

**Fix:** Replace with the `cors` package (already installed) and restrict the origin:
```ts
import cors from "cors";
app.use(cors({ origin: process.env.ALLOWED_ORIGIN ?? "https://your-domain.com" }));
```

---

## 3 · Memory / Performance

### 🟡 PERF-01 — `FallbackSphere` leaks a material on every mount

**File:** `client/src/components/solar-system/Planet.tsx` — `FallbackSphere`

The non-emissive branch of the `useMemo` in `FallbackSphere` creates a new `MeshStandardMaterial` on every component mount without caching or disposing it. Since fallback spheres can re-mount (e.g. on Suspense boundary retries), this slowly leaks GPU material objects.

```ts
// current — new material every mount, never disposed
const mat = useMemo(() => {
  if (emissive) return getFallbackMaterial(color, true); // cached ✓
  const m = new THREE.MeshStandardMaterial({ ... });    // not cached ✗
  return m;
}, [...]);
```

**Fix:** Either extend `getFallbackMaterial` to also cache the non-emissive case with a unique key, or return a cleanup function from a `useEffect` that calls `mat.dispose()`.

---

### 🟡 PERF-02 — `OrbitRings` geometry rebuilt on every `scaleMultiplier` change

**File:** `client/src/components/solar-system/OrbitRings.tsx`

The `useMemo` that builds the merged `BufferGeometry` for all orbit lines depends on `scaleMultiplier`. Every time the user toggles scale mode the entire geometry (all 29 orbits × 128 segments × 2 vertices) is recomputed and re-uploaded to GPU. The geometry and colors don't actually change — only the radius values do. Pre-computing at scale=1 and using `geometry.attributes.position` update-in-place, or a `scale` uniform, would eliminate this.

---

### 🟡 PERF-03 — `makeNebulaTexture` runs synchronously on the main thread at 1024×1024

**File:** `client/src/components/solar-system/NebulaBackground.tsx`

The nebula texture is generated via nested per-pixel loops with FBM noise (4 octaves, 1M iterations). This blocks the main thread for a noticeable amount of time on mobile or low-end devices. It is wrapped in `useMemo` so it only runs once, but that first render stall is real.

**Fix:** Offload to a `Worker`, or reduce to 512×512 (barely visible quality difference at this opacity), or generate asynchronously with a `useEffect` + loading state.

---

## 4 · Code Quality / Smells

### 🔵 SMELL-01 — Suppressed exhaustive-deps in AI fetch `useEffect`

**File:** `client/src/components/solar-system/SolarSystem.tsx`

```ts
}, [active.id]); // eslint-disable-line react-hooks/exhaustive-deps
```

`aiCache` is missing from the dependency array. The intent is correct (don't re-fetch if already cached), but the right pattern is to include `aiCache` and gate with `if (aiCache[active.id]) return` inside the effect — which is already done. Adding `aiCache` to the dep array would cause unnecessary effect re-runs on unrelated cache updates. The proper fix is to restructure the cache check or use `useRef` for the cache.

---

### 🔵 SMELL-02 — `scaleMode` state has four string values but three are effectively unused in the UI

**File:** `client/src/components/solar-system/SolarSystem.tsx` and `ScaleControl.tsx`

`ScaleMode` has four values (`"visual"`, `"hybrid"`, `"realSize"`, `"realDistance"`). The `ScaleControl` component exposes all four, but the README and UI only document two meaningful modes. The `"hybrid"` and `"realSize"` multipliers (`0.6`, `0.35`) produce intermediate scales with no visual labels explaining what they mean.

---

### 🔵 SMELL-03 — `saturation` and `speed` props declared but unused in `InstancedStars`

**File:** `client/src/components/solar-system/InstancedStars.tsx`

```ts
type Props = {
  ...
  saturation?: number;  // never used
  speed?: number;       // never used
};
```

These props are in the type but the component never reads them. Either implement or remove.

---

### 🔵 SMELL-04 — `queryClient.ts` and `use-is-mobile.tsx` are dead code

**File:** `client/src/lib/queryClient.ts`, `client/src/hooks/use-is-mobile.tsx`

`queryClient.ts` sets up `@tanstack/react-query` which is listed in AGENTS.md as an unused dependency. `use-is-mobile.tsx` is not imported anywhere. Both files can be deleted.

---

## 5 · Known / Documented Issues (no action needed)

| ID | File | Note |
|----|------|------|
| ⚪ INFO-01 | `shared/schema.ts` | TS errors from drizzle-orm PG types — `@neondatabase/serverless` not installed. Documented in AGENTS.md, does not affect frontend build. |
| ⚪ INFO-02 | `node_modules/` | Committed to git (~245 MB). Documented in AGENTS.md. |
| ⚪ INFO-03 | `stats.html` | Build artifact from `rollup-plugin-visualizer`, not gitignored. Documented in AGENTS.md. |
| ⚪ INFO-04 | `package.json` | Large set of unused deps (`framer-motion`, `recharts`, `@radix-ui/*`, `howler`, etc.). Documented in AGENTS.md. |
| ⚪ INFO-05 | `bun.lock` | Stale artifact, project uses npm. Documented in AGENTS.md. |

---

## 6 · Fix Priority

| Priority | ID | File | Effort |
|----------|----|------|--------|
| 1 | BUG-01 | `InstancedStars.tsx` | 1 line |
| 2 | BUG-02 | `FocusCamera.tsx` | ~15 lines |
| 3 | SEC-01 | `server/app.ts` | ~5 lines |
| 4 | BUG-03 | `Planet.tsx` (GLBModel) | ~5 lines |
| 5 | PERF-01 | `Planet.tsx` (FallbackSphere) | ~10 lines |
| 6 | PERF-03 | `NebulaBackground.tsx` | resize to 512 |
| 7 | SMELL-03 | `InstancedStars.tsx` | remove 2 lines |
| 8 | SMELL-04 | `queryClient.ts`, `use-is-mobile.tsx` | delete files |
