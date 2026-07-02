# AGENTS.md — Solar System

## Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Dev server (:5000) via Express + Vite HMR |
| `npm run check` | `tsc` — type checking |
| `npm test` | `vitest run` — 130+ tests (data integrity + store logic) |
| `npm run test:watch` | `vitest` — watch mode for TDD |
| `npm run build` | `copy-draco.sh && vite build && esbuild server` → `dist/` |
| `npm run build:cf` | Cloudflare static build (copies Draco → vite build → `dist/`) |
| `npm start` | Production: `node dist/index-prod.js` (build first) |
| `npm run downscale` | GLB optimization via `gltf-transform` (after regeneration) |
| `npm run models:generate` | Generate GLBs from Blender (downloads real textures from Solar System Scope) |
| `npm run models:validate` | Validate GLBs against spaceAI ML classification |
| `npm run db:push` | Push Drizzle schema to PostgreSQL (Neon.tech) |
| `npm run ai:train` | Train classifier (RF/SVC/LogReg, optional `--tune`) |
| `npm run ai:train-regression` | Train mass + temperature regressors |
| `npm run ai:test` | Run Python test suite (46 tests) |
| `npm run ai:serve` | Start FastAPI microservice on :8000 |
| `bash scripts/dev.sh` | Full-stack: Express (:5000) + FastAPI (:8000) |

## Architecture

SPA, no SSR. Entry: `client/index.html` → `main.tsx` → lazy `SolarSystem`.

**Canvas `frameloop="demand"`** — every `useFrame` must call `state.invalidate()` or scene freezes. Done in `Planet`, `CinematicTour`, `FocusCamera`.

- **Path aliases**: `@/*` → `client/src/*`, `@shared/*` → `shared/*`
- **GLB asset pointers**: `client/src/assets/solar/*.glb.asset.json` contain `{"url":"/models/<name>.glb"}`. CDN swap = edit JSON only. No hardcoded URLs.
- **Draco decoder**: `lib/draco-setup.ts` wires `useGLTF.setDRACOLoader()` via type assertion. WASM from `three/examples/jsm/libs/draco/`, auto-copied on build.
- **Loading**: No preload. `LoadingSpinner` tracks 29 bodies; hides on all-loaded or 15s timeout.
- **Camera distance**: `CinematicTour`/`FocusCamera` use `computedRadii` ref (populated by `Planet` after GLB bounding-box calc). Falls back to `visualRadius`.
- **Tour**: 5s per body, cycles through all 29. Camera arc = 1.2π radians (~216°).
- **FastAPI proxy**: Express `GET /api/ai/classify/:bodyId` and `GET /api/ai/precomputed` → `SPACEAI_URL` (default `127.0.0.1:8000`), 10s timeout, in-memory response cache.
- **Cloudflare Functions**: `functions/api/ai/classify/[bodyId].js` mirrors the same proxy for CF Pages deploy. SPA fallback: `client/public/_redirects` (`/* /index.html 200`).
- **Docker**: `docker-compose up` → `spaceai` (:8000) + `app` (:5000). `SPACEAI_URL=http://spaceai:8000` in container.

## CI / Deploy

- **`deploy.yml`**: On push to `Master` — `npm ci && npm run build:cf && wrangler pages deploy` to Cloudflare Pages.
- **`validate-data.yml`**: On push/PR to `main` — validates `spaceAI/` taxonomy JSON schema via Python.
- **`opencode.yml`**: On `/oc` or `/opencode` in PR/issue comments — triggers opencode review agent.

## Unused Dependencies

Installed in `package.json` but not actually used: `@tanstack/react-query`, `framer-motion`, `react-router-dom`, `wouter`, `howler`, `meshline`, `r3f-perf`, `recharts`, `sonner`, `vaul`, `cmdk`, `embla-carousel-react`, all `@radix-ui/*`.

## Known Issues

- `shared/schema.ts` has TS errors (drizzle-orm PG types not installed) — ignore.
- `node_modules/` is **committed** (~245 MB).
- `stats.html` is a build artifact (`rollup-plugin-visualizer`), not gitignored.
- Earth/Mercury/Mars GLBs are downscaled for mobile. Re-run `npm run downscale` after regeneration.

## Sub-projects

- **`spaceAI/`**: Python ML microservice. Uses 11 features for classification (RF/SVC/LogReg) + regression (mass, temperature). Dependencies in `requirements.txt`. CLI: `python run.py [train|cv|test|classify|query|recommend|train-regression|predict-mass|predict-temperature|serve]`. FastAPI at `api.py`. Precomputed cache at startup → `GET /precomputed`. Train with `npm run ai:train` before serving. Tests: `npm run ai:test` (46 tests).
- **`scripts/`**: `copy-draco.sh` (pre-build), `downscale-textures.sh` (GLB resize via gltf-transform), `dev.sh` (full-stack launcher), `generate_celestial_models.py` (Blender GLB generation with real texture downloads), `validate_models.py` (ML-based GLB validation). Blender scripts require Blender 3.4+.

## Conventions

- **Update all markdowns** — when changing code/docs, keep every `.md` file consistent.
- Package manager is **npm** (ignore `bun.lock` — stale artifact).
- The `dist/` directory is build output (gitignored per `.gitignore`).
