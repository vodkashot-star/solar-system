# AGENTS.md

## Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Express :5000 + FastAPI :8000 (concurrently) |
| `npm run check` | `tsc` — 0 errors expected |
| `npm test` | `vitest run` — client/src/**/*.test.{ts,tsx} |
| `npm run build` | `copy-draco.sh && vite build && esbuild server` → `dist/` |
| `npm run build:cf` | Static SPA build (no server) for Netlify/Cloudflare |
| `npm start` | Production: `node dist/index-prod.js` on :5000 |
| `npm run validate` | `tsc && vitest run` |
| `npm run db:generate` | `drizzle-kit generate` |
| `npm run db:push` | `drizzle-kit push` |
| `npm run db:migrate` | `db:generate && db:push` |
| `npm run db:studio` | Drizzle Studio |
| `npm run ai:train` | `cd spaceAI && python run.py train` |
| `npm run ai:train-all` | Train classifier + regressors |
| `npm run ai:test` | `cd spaceAI && python -m pytest tests/ -v` |
| `npm run ai:serve` | `cd spaceAI && python run.py serve` |

## Entry & Architecture

- **Client**: `client/index.html` → `main.tsx` → lazy `SolarSystem`
- **Server dev**: `server/index-dev.ts` (Vite middleware, hot reload)
- **Server prod**: `server/index-prod.ts` (manual MIME handling — `.js`/`.css`/`.glb` MIME map)
- **Canvas `frameloop="demand"`** — every `useFrame` must call `state.invalidate()`
- **Path aliases**: `@/*` → `client/src/*`, `@shared/*` → `shared/*`
- **Vite root**: `client/`, outDir `dist/`
- **Chunk splitting**: `vendor_react` (react/react-dom), `vendor_shared` (everything else)
- **API base**: relative `/api` in dev (Vite proxies Express :5000), absolute URL in production
- **AI fetch failures silently caught** — frontend works without AI data

## Database

`shared/schema.ts` — Drizzle `pgTable` on PostgreSQL (Neon via `DATABASE_URL`):

| Table | Purpose |
|-------|---------|
| `celestial_bodies` | Body catalog (18 columns: id, name, type, 11 physical properties, AI fields, timestamps) |
| `ai_cache` | Precomputed AI classification per bodyId |
| `prediction_logs` | Regression prediction history |
| `corrections` | User-submitted classification corrections |

`server/db.ts` initialises Drizzle with `postgres` driver.

## GLB Assets

- **Actual GLB files**: `client/public/models/<name>.glb` — 34 binary files
- **Asset manifests**: `client/src/assets/solar/<name>.glb.asset.json` — pointer: `{"url":"/models/<name>.glb"}`
  CDN swap = edit JSON only
- **Draco WASM**: `scripts/copy-draco.sh` copies to `dist/draco/` on build
- **6 spacecraft need real GLBs**: `jwst`, `new-horizons`, `juno-spacecraft`, `voyager-2`, `dragonfly` (+ `juno-spacecraft` has its own asset JSON now, separate from asteroid Juno)
- **Asset JSON convention**: `client/src/assets/solar/<id>.glb.asset.json` → `{"url":"/models/<id>.glb"}` — create a new file per spacecraft to avoid import collisions

## Spacecraft

- Rendered by `SpacecraftOrbit.tsx` (wraps `Planet` with parent-relative offset)
- Spacecraft with `parentBody` orbit that body; without `parentBody` orbit the Sun
- Voyager 1/2 use hyperbolic Kepler solver (`solveKeplerHyperbolic` in `Planet.tsx`)

## AI API (Express :5000)

All in `server/routes.ts`. Request cascade: Drizzle DB → JSON fallback → FastAPI proxy:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/ai/precomputed` | GET | All precomputed classifications |
| `/api/ai/classify/:bodyId` | GET | Classify single body (query: 11 feature params) |
| `/api/ai/correct` | POST | Submit correction (stored in both Postgres + FastAPI SQLite) |
| `/api/bodies` | GET/POST | CRUD for `celestial_bodies` table |
| `/api/bodies/:id` | GET/PATCH/DELETE | Single body CRUD |

## spaceAI (Python ML on :8000)

- `spaceAI/src/predict.py` — 11 features, RF/SVC/LogisticRegression/Ensemble classifiers
- `train_model.py` does final `pipe.fit(X, y)` on full dataset after eval split so rare classes appear in `pipeline.classes_` — never remove this
- SQLAlchemy models in `database.py` mirror Drizzle schema
- `POST /classify/{body_id}/correct` and `GET /corrections` for user feedback loop
- `npm run ai:retrain` retrains incorporating corrections from DB

## Known Issues

- **`drizzle-kit generate` may need TTY workaround**: `script -q -c "echo 4 | npx drizzle-kit generate" /dev/null`
- **Production JS MIME fix**: `server/index-prod.ts:29-39` — esbuild bundles `.js`/`.css` with wrong MIME; manual `fs.readFileSync` + MIME lookup required
- **SpacecraftOrbit parentPosition**: reads from `positions` ref directly inside `useFrame` (not as prop) — prop would be stale since refs don't trigger re-render
- `stats.html` is a build artifact from rollup-plugin-visualizer — gitignored
- `.env*` gitignored; set `DATABASE_URL` for DB features
