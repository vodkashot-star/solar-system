# AGENTS.md — Solar System

## Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Vite dev server via Express middleware (HMR, port **5000**) |
| `npm run build` | `bash scripts/copy-draco.sh && vite build && esbuild server/index-prod.ts --platform=node --packages=external --bundle --format=esm --outdir=dist` |
| `npm run check` | `tsc` — **sole** verification step (no linter, no tests) |
| `npm start` | `NODE_ENV=production node dist/index-prod.js` (dist must exist) |
| `npm run downscale` | Downscale Earth/Mercury/Mars GLBs via `gltf-transform` (run after Blender regeneration) |
| `bash scripts/dev.sh` | Starts Express (:5000) + FastAPI (:8000), kills both on Ctrl+C. Needs Python venv in `spaceAI/`. |

## Architecture

Single-page cinematic 3D tour. **`frameloop="demand"`** — every animation path must call `state.invalidate()` or canvas freezes. Planet `useFrame`, CinematicTour, FocusCamera, and OrbitControls all do this.

### Key patterns

- **Click-to-focus**: `Planet.onClick` → zustand `focus(bodyId, position)` → `FocusCamera` lerps camera to body. Tour pauses while focused.
- **Camera distance**: Both `CinematicTour` and `FocusCamera` use `computedRadii` ref (populated by `Planet` after GLB bounding-box calc). Falls back to `visualRadius`. Saturn rings are included in the box.
- **GLB loading**: No module-level preload. GLBs load on-demand per `Suspense` boundary. `LoadingSpinner` tracks per-body status via `lib/load-debugger.ts` (subscribe/getSnapshot pattern). Hides after all 29 load or 15s timeout.
- **Asset pointers**: `client/src/assets/solar/*.glb.asset.json` contain `{"url":"/models/<name>.glb"}`. Swapping to CDN = edit JSON only.
- **Path aliases**: `@/*` → `client/src/*`, `@shared/*` → `shared/*` (in tsconfig + vite.config).
- **Context loss**: Listener in `SolarSystem.tsx` `onCreated` shows recovery overlay + "Reload page" button.
- **Draco decoder**: `lib/draco-setup.ts` calls `useGLTF.setDRACOLoader()` — exists at runtime but absent from drei's `.d.ts`. Uses type assertion. Copy decoder WASM from `node_modules/three/examples/jsm/libs/draco/` via `scripts/copy-draco.sh` (auto-runs on build).
- **FastAPI proxy**: Express proxies `/api/ai/classify/:bodyId` → `localhost:8000` with 10s timeout + response cache.

### Entrypoints

- `client/src/main.tsx` → `App.tsx` → lazy `SolarSystem` (in `components/solar-system/`)
- `server/index-dev.ts` (dev) / `server/index-prod.ts` (prod) — Express only, no SSR

## Orphaned (do not reintroduce)

- **Components**: (none — ScaleControl was wired in)
- **Packages**: `@tanstack/react-query`, `framer-motion`, `react-router-dom`, `wouter`, `howler`, `meshline`, `r3f-perf`, `recharts`, `sonner`, `vaul`, `cmdk`, `embla-carousel-react`, all `@radix-ui/*`
- **Files**: `shared/schema.ts` has TS errors (drizzle-orm PG types not installed) — pre-existing, ignore

## Sub-projects

- `scripts/`: Blender Python scripts for procedural GLB generation. Requires Blender 3.4+. Run via `bash scripts/run_blender_generation.sh`. Check `add_detail=True` settings — can cause multi-MB outputs.
- `spaceAI/`: Python ML sub-project (pip, RandomForest). See `spaceAI/spaceAI.md`.

## Gotchas

- `node_modules/` is committed to the repo.
- `stats.html` is a build artifact from `rollup-plugin-visualizer`, not gitignored.
- Earth/Mercury/Mars GLBs were downscaled for mobile (22→0.6 MB, 20→0.6 MB, 19→2.6 MB). Re-run `npm run downscale` after Blender regeneration.
- `*.env.local` files exist for credentials but are not tracked in git.
- Do not add test infrastructure or testing dependencies unless asked — none is configured.
