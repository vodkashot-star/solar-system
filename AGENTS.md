# AGENTS.md — Solar System

## Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Starts Vite dev server via Express middleware (HMR, port 5000) |
| `npm run build` | `bash scripts/copy-draco.sh && vite build && esbuild server/index-prod.ts --bundle --outdir=dist` |
| `npm run check` | `tsc` — sole verification step (no linter, no tests) |
| `npm start` | `NODE_ENV=production node dist/index-prod.js` (serves built static) |

No linter, test framework, or CI exists. `npm run check` is the only way to validate code.

## Architecture

Single-page cinematic 3D solar system tour. Source lives under `client/src/`:

```
components/solar-system/
  SolarSystem.tsx      — Canvas, scene setup, frameloop="demand", HUD overlay, context-loss recovery
  Planet.tsx           — GLB loader + orbital/spin logic, click-to-focus, Saturn rings, computed-radius reporting
  CinematicTour.tsx    — Camera animation state machine (damp3 from maath), uses computed radii
  OrbitRings.tsx       — Single merged LineSegments (1 draw call) for all 8 orbit paths
  InstancedStars.tsx   — Custom Points-based star field (replaces drei Stars)
  FocusCamera.tsx      — Camera lerp controller driven by zustand focus store, uses computed radii
  bodies.ts            — Body config array (Sun + 8 planets)
stores/
  camera-focus.ts      — Zustand store: focus(bodyId, position) / clear()
lib/
  draco-setup.ts       — Wires DRACOLoader into drei's useGLTF via setDRACOLoader()
```

### Key patterns

- **`frameloop="demand"`** — every animation path MUST call `state.invalidate()` or the canvas won't re-render. Planet `useFrame`, CinematicTour, FocusCamera, and OrbitControls all call it. Missing `invalidate()` causes frozen visuals.
- **Click-to-focus**: Planet `onClick` → zustand `focus(bodyId, position)` → `FocusCamera` lerps camera to body using `computedRadii` for distance. Tour pauses while focused.
- **Camera distance**: Both `CinematicTour` and `FocusCamera` use a `computedRadii` ref (populated by `Planet` after GLB load) instead of hardcoded `visualRadius`. Fallback to `visualRadius` if not yet computed. Saturn rings are included in the bounding box.
- **Context loss**: `SolarSystem.tsx` `onCreated` adds `webglcontextlost`/`webglcontextrestored` listeners. Shows a recovery overlay, auto-restores on `restored` event, provides a manual "Reload page" fallback.
- **Scale toggle**: Button switches between `"cinematic"` (1×) and `"realistic"` (0.25×) scale multipliers for orbits and visual radii.
- **GLB loading**: No module-level preload. GLBs load on-demand per `Suspense` boundary. Fallback colored spheres appear immediately; GLBs swap in asynchronously per planet. LoadingSpinner blocks until `useProgress >= 100`.
- **Asset pointers**: `client/src/assets/solar/*.glb.asset.json` contain `{"url":"/models/<name>.glb"}`. Import JSON, use `.url` — swapping CDN paths requires no code changes.
- **Path aliases**: `@/*` → `client/src/*`, `@shared/*` → `shared/*` (configured in tsconfig and vite.config).
- **Server** (`server/`): Minimal Express with `/api/health`. Dev mode runs Vite middleware; prod serves `dist/` as SPA fallback.

## Draco decoder

- `client/public/draco/` contains `draco_decoder.wasm`, `draco_decoder.js`, `draco_wasm_wrapper.js`.
- Copied from `node_modules/three/examples/jsm/libs/draco/` via `bash scripts/copy-draco.sh`.
- `npm run build` auto-runs the copy script. For dev mode, you may need to run it manually once.
- `initDracoDecoder()` in `draco-setup.ts` calls `useGLTF.setDRACOLoader()` (runtime exists, but missing from drei `.d.ts` — uses a type assertion cast).
- Called once in `App.tsx` `useEffect`.

## Orphaned but harmless

The following installed packages are no longer imported by any source file — do not reintroduce without verification:
- `@tanstack/react-query`, `framer-motion`, `react-router-dom`, `wouter`, `howler`, `meshline`, `r3f-perf`, `recharts`, `sonner`, `vaul`, `cmdk`, `embla-carousel-react`, and all `@radix-ui/*` packages.
- `shared/schema.ts` has TS errors (`drizzle-orm` not installed) — pre-existing, ignore.

## Sub-projects (separate tooling)

- `scripts/`: Blender Python scripts for procedural GLB generation. Run via `bash scripts/run_blender_generation.sh`. Blender 3.4+ required.
- `spaceAI/`: Python ML sub-project (Poetry, DecisionTree classifier). See `spaceAI/spaceAI.md`.

## Gotchas

- `node_modules/` is committed to the repo.
- `*.env.local` files exist for credentials but are not tracked in git.
- `stats.html` is a build artifact from `rollup-plugin-visualizer`, not gitignored.
- Do not add test infrastructure or testing dependencies unless explicitly asked — none is configured.
- `useGLTF.setDRACOLoader()` exists at runtime in drei's compiled JS but is absent from the `.d.ts`. Any future drei version bump must confirm this still works.
- Uranus GLB was optimized from 83 MB → 277 KB (Draco-compressed, `add_detail=False`). The source script `generate_celestial_models.py` was also fixed for Neptune. If regenerating all GLBs, check for other planets with `add_detail=True` (default) that may cause large output.
