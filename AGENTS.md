# AGENTS.md — Solar System

## Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Dev server (:5000), Vite HMR via Express middleware |
| `npm run check` | `tsc` — **sole verification** (no linter, no tests) |
| `npm run build` | `copy-draco.sh && vite build && esbuild server` → `dist/` |
| `npm start` | Production: `node dist/index-prod.js` (build first) |
| `npm run downscale` | GLB optimization via `gltf-transform` (after regeneration) |
| `npm run db:push` | Push Drizzle schema to PostgreSQL (Neon.tech) |
| `bash scripts/dev.sh` | Full-stack: Express (:5000) + FastAPI (:8000) |

## Architecture

SPA, no SSR. Entry: `client/index.html` → `main.tsx` → lazy `SolarSystem`.

**Canvas `frameloop="demand"`** — every `useFrame` must call `state.invalidate()` or the scene freezes. Done in `Planet`, `CinematicTour`, `FocusCamera`.

- **Path aliases**: `@/*` → `client/src/*`, `@shared/*` → `shared/*`
- **GLB asset pointers**: `client/src/assets/solar/*.glb.asset.json` contain `{"url":"/models/<name>.glb"}`. CDN swap = edit JSON only. No hardcoded URLs.
- **Draco decoder**: `lib/draco-setup.ts` wires `useGLTF.setDRACOLoader()` via type assertion (missing from drei `.d.ts`). WASM from `node_modules/three/examples/jsm/libs/draco/`, auto-copied on build.
- **Loading**: No preload. `LoadingSpinner` (subscribe/getSnapshot) tracks 29 bodies; hides on all-loaded or 15s timeout.
- **Camera distance**: `CinematicTour`/`FocusCamera` use `computedRadii` ref (populated by `Planet` after GLB bounding-box calc). Falls back to `visualRadius`.
- **Tour**: 5s per body, cycles through all 29. Camera arc = 1.2π radians ~216°.
- **FastAPI proxy**: Express `GET /api/ai/classify/:bodyId` → `SPACEAI_URL` (default `localhost:8000`), 10s timeout, in-memory response cache.
- **Docker**: `docker-compose up` → `spaceai` (:8000) + `app` (:5000). `SPACEAI_URL=http://spaceai:8000` in container.

## Orphaned (do not reintroduce)

**Installed but unused**: `@tanstack/react-query`, `framer-motion`, `react-router-dom`, `wouter`, `howler`, `meshline`, `r3f-perf`, `recharts`, `sonner`, `vaul`, `cmdk`, `embla-carousel-react`, all `@radix-ui/*`.

**Ignore**: `shared/schema.ts` has TS errors (drizzle-orm PG types not installed).

## Sub-projects

- **`spaceAI/`**: Python ML microservice. Dependencies in `requirements.txt`. CLI: `python run.py [train|test|classify|query|recommend|serve]`. FastAPI at `api.py`. Model at `models/celestial_classifier.pkl`. Train with `python run.py train` before serving.
- **`scripts/`**: Blender Python scripts for procedural GLB generation. Requires Blender 3.4+. Run via `bash scripts/run_blender_generation.sh`.

## Gotchas

- `node_modules/` is **committed** (~245 MB).
- `stats.html` is a build artifact (rollup-plugin-visualizer), not gitignored.
- Earth/Mercury/Mars GLBs downscaled for mobile (22→0.6 MB, 20→0.6 MB, 19→2.6 MB). Re-run `npm run downscale` after regeneration.
- No test infrastructure — do not add testing deps unless asked.

## Cloudflare Pages

- Static build: `npm run build:cf` (copies Draco → vite build → `dist/`)
- SPA fallback: `client/public/_redirects` (`/* /index.html 200`) — auto-copied to `dist/`
- API routes: `functions/` directory at repo root. `/api/health` and `/api/ai/classify/:bodyId` (proxies to `SPACEAI_URL` env var).
- Connect repo via Cloudflare Pages dashboard:
  - Build command: `npm run build:cf`
  - Output directory: `dist`
- AI classification requires setting `SPACEAI_URL` env var in Cloudflare Pages dashboard pointing to your FastAPI instance.
