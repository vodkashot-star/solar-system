# AGENTS.md

## Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Express :5000 + FastAPI :8000 (concurrently via `tsx` + `uvicorn`) |
| `npm run check` | `tsc` — 0 errors expected |
| `npm test` | `vitest run` — `client/src/**/*.test.{ts,tsx}` (happy-dom) |
| `npm run build` | `scripts/copy-draco.sh && vite build && esbuild server` → `dist/` |
| `npm run build:cf` | Static SPA (no server) for Netlify/Cloudflare |
| `npm start` | Production: `node dist/index-prod.js` on :5000 |
| `npm run validate` | `tsc && vitest run` |
| `npm run db:migrate` | `drizzle-kit generate && drizzle-kit push` |
| `npm run ai:train` | `cd spaceAI && python run.py train` |
| `npm run ai:serve` | `cd spaceAI && python run.py serve` |
| `npm run ai:test` | `cd spaceAI && python -m pytest tests/ -v` |
| `npm run ai:retrain` | Retrain with corrections from DB |

## Architecture

- **Client**: `client/index.html` → `main.tsx` → lazy `SolarSystem`
- **Server dev**: `server/index-dev.ts` (Vite middleware, hot reload)
- **Server prod**: `server/index-prod.ts` — manual `fs.readFileSync` + MIME lookup (`server/index-prod.ts:17-27`), esbuild bundles `.js`/`.css` with wrong MIME
- **API base**: relative `/api` in dev (Vite proxies Express :5000), absolute URL in production
- **AI fetch failures silently caught** — frontend works without AI data
- **Canvas `frameloop="demand"`** — every `useFrame` must call `state.invalidate()`, or scene freezes
- **Path aliases**: `@/*` → `client/src/*`, `@shared/*` → `shared/*`
- **Vite root**: `client/`, outDir `dist/`
- **Chunk splitting**: `vendor_react` (react/react-dom), `vendor_shared` (everything else)

## GLB Assets

- **GLB files**: `client/public/models/<name>.glb` — 34 binary files (public domain NASA models)
- **Asset manifests**: `client/src/assets/solar/<name>.glb.asset.json` — pointer: `{"url":"/models/<name>.glb"}`. CDN swap = edit JSON only. **Never hardcode `/models/` URLs.**
- **Draco WASM**: `scripts/copy-draco.sh` copies `node_modules/three/examples/jsm/libs/draco/*` → `client/public/draco/` and `dist/draco/`. Must run before both dev and build.
- **6 spacecraft need real GLBs**: `jwst`, `new-horizons`, `juno-spacecraft`, `voyager-2`, `dragonfly` (+ `juno-spacecraft` separate from asteroid Juno)

## Spacecraft

- `SpacecraftOrbit.tsx` wraps `Planet` with parent-relative offset (`positions` ref inside `useFrame` — not a prop, since refs don't trigger re-render)
- Spacecraft with `parentBody` orbit that body; without it orbit the Sun
- Voyager 1/2 use hyperbolic Kepler solver (`solveKeplerHyperbolic` in `Planet.tsx`)

## Database

`shared/schema.ts` — Drizzle `pgTable` on PostgreSQL (Neon via `DATABASE_URL`):

| Table | Purpose |
|-------|---------|
| `celestial_bodies` | Body catalog (18 columns) |
| `ai_cache` | Precomputed AI classification per bodyId |
| `prediction_logs` | Regression prediction history |
| `corrections` | User-submitted classification corrections |

`server/db.ts` initialises Drizzle with `postgres` driver.

## AI API (Express :5000)

All in `server/routes.ts`. Request cascade: Drizzle DB → static fallback (`STATIC_CLASSIFICATIONS` for 9 known spacecraft) → FastAPI proxy to :8000:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/ai/precomputed` | GET | All precomputed classifications |
| `/api/ai/classify/:bodyId` | GET | Classify single body (query: 11 feature params) |
| `/api/ai/correct` | POST | Submit correction (Postgres + FastAPI SQLite) |
| `/api/bodies` | GET/POST | CRUD for `celestial_bodies` table |
| `/api/bodies/:id` | GET/PATCH/DELETE | Single body CRUD |

## spaceAI (Python ML on :8000)

- `spaceAI/src/predict.py` — `CelestialPredictor` class: 11 features, RF/SVC/LogisticRegression/Ensemble
- **Training quirk**: `train_model.py` calls `pipe.fit(X, y)` on full dataset _after_ evaluation split so rare classes appear in `pipeline.classes_` — never remove this
- Express loads `data/ai_cache.json` at startup — no FastAPI runtime needed in production
- Corrections: `POST /classify/{body_id}/correct` and `GET /corrections` for user feedback loop

## Known Issues

- **`drizzle-kit generate` may need TTY workaround**: `script -q -c "echo 4 | npx drizzle-kit generate" /dev/null`
- **Draco must be copied before dev**: `scripts/copy-draco.sh` runs as part of `build`/`build:cf` but NOT `dev` — if models fail to load, run it manually
- `stats.html` is a build artifact from rollup-plugin-visualizer — gitignored
- `.env*` gitignored; set `DATABASE_URL` for DB features, `SPACEAI_URL` for FastAPI proxy
- `.opencode` is gitignored
