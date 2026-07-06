# AGENTS.md — Solar System

## Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Express on :5000 via Vite middleware + FastAPI AI trainer on :8000 |
| `npm run check` | `tsc` — 0 errors expected |
| `npm test` | `vitest run` — 2 files (parameterized) |
| `npm run build` | `copy-draco.sh && vite build && esbuild server` → `dist/` |
| `npm run build:cf` | Static SPA build (`copy-draco.sh → vite build` → `dist/`) |
| `npm start` | Production: `node dist/index-prod.js` on :5000 (build first) |
| `npm run models:convert -- "<obj>" <name>` | NASA OBJ → Draco GLB |
| `npm run db:push` | Push Drizzle schema to PostgreSQL (Neon) |
| `npm run db:migrate` | `db:generate && db:push` |
| `npm run db:studio` | Drizzle Studio UI |
| `npm run ai:train` | `cd spaceAI && python run.py train` |
| `npm run ai:train-all` | Train classifier + regressors sequentially |
| `npm run ai:retrain` | Retrain classifier with user corrections from DB |
| `npm run ai:test` | pytest — 50 tests in `spaceAI/tests/` |
| `npm run ai:serve` | FastAPI on :8000 (training-only, not needed at runtime) |

`cd spaceAI && python run.py <cmd>` is the CLI entry for all AI commands.

## Entry & Architecture

- **Client**: `client/index.html` → `main.tsx` → lazy `SolarSystem`
- **Server**: `server/index-dev.ts` (Vite middleware during dev) or `server/index-prod.ts` (static from `dist/`)
- **Canvas `frameloop="demand"`** — every `useFrame` must call `state.invalidate()` or scene freezes
- **Path aliases**: `@/*` → `client/src/*`, `@shared/*` → `shared/*`
- **Vite root**: `client/`, outDir `dist/`
- **Chunk splitting** in `vite.config.ts`: `vendor_react` (react/react-dom) and `vendor_shared` (everything else)
- **API base**: relative `/api` in dev (Vite proxies to :5000), absolute URL in production (`config.ts:13-18`)
- **Frontend works without AI data**: all AI fetch failures silently caught
- **Docker**: `docker-compose up` starts Express on :5000 only (no spaceAI container)
- **Deploy**: `netlify.toml` / `wrangler.toml` — SPA fallback via `_redirects`. CI runs `validate-data.yml` (pytest + tsc + vitest) on push/PR to `Master`.

## AI API (Express)

All endpoints served from `server/routes.ts`. Reads `ai_cache` PostgreSQL table first; falls back to `spaceAI/data/ai_cache.json` if DB unreachable. Corrections persisted to `corrections` table.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | DB-connected body count |
| `/api/ai/precomputed` | GET | All precomputed classifications |
| `/api/ai/classify/:bodyId` | GET | Single body classification |
| `/api/ai/correct` | POST | Submit correction (body_id, corrected_type required) |
| `/api/classify/:bodyId/correct` | POST | Same, bodyId from URL param |
| `/api/bodies` | GET | List all celestial_bodies (ordered by name) |
| `/api/bodies/:id` | GET | Single body by ID |
| `/api/bodies` | POST | Create body (name, type required) |
| `/api/bodies/:id` | PATCH | Partial update |
| `/api/bodies/:id` | DELETE | Delete body |

## Database

`shared/schema.ts` defines 4 Drizzle `pgTable` tables:

| Table | Purpose |
|-------|---------|
| `celestial_bodies` | Celestial body catalog (id, name, type, properties, AI fields) |
| `ai_cache` | Precomputed AI classification per bodyId |
| `prediction_logs` | Regression prediction history |
| `corrections` | User-submitted classification corrections |

`server/db.ts` initializes Drizzle with `postgres` driver using `DATABASE_URL`.

## spaceAI (Python ML — training only)

- 27 precomputed bodies, 11 features, classifiers: RF/SVC/LogisticRegression
- **Training quirk**: `train_model.py` calls `pipe.fit(X, y)` on the full dataset _after_ evaluation split so rare classes appear in `pipeline.classes_`. Never remove this final fit.
- Tests seed cache at module level via `precompute_all()`
- `shared/schema.ts` mirrors spaceAI's SQLAlchemy models as Drizzle `pgTable`

## GLB Assets

- Each model has a `.glb.asset.json` file: `{"url":"/models/<name>.glb"}` — CDN swap = edit JSON only
- 5 spacecraft stubs (JWST, New Horizons, Juno, Voyager 2, Dragonfly) need real GLBs from NASA 3D Resources
- `client/src/lib/draco-setup.ts` wires `useGLTF.setDRACOLoader()`; WASM copies on build
- Juno spacecraft uses `juno-spacecraft` ID and `junoSpacecraftGlb` import (avoids collision with asteroid 3 Juno)

## Spacecraft

- Spacecraft with `parentBody` (Curiosity→mars, Cassini→saturn, Hubble→earth, Apollo LM→earth, Juno→jupiter, Dragonfly→saturn) are rendered by `SpacecraftOrbit.tsx` — per-frame circular offset around parent.
- Spacecraft without `parentBody` orbit the Sun directly (JWST, New Horizons, Voyager 1/2).
- Voyager 1 (e=3.8) and Voyager 2 (e=1.06) use hyperbolic Kepler solver (`solveKeplerHyperbolic` in `Planet.tsx:31-45`).

## Known Issues

- 5 spacecraft GLB stubs (JWST, New Horizons, Juno, Voyager 2, Dragonfly) need real GLB files downloaded to `client/public/models/<name>.glb`
- `stats.html` is a build artifact from `rollup-plugin-visualizer` — gitignored
- `.env*` gitignored; create `server/.env.local` for overrides
- **Production JS MIME fix**: `npm start` must serve `.js`/`.css` from `dist/` with correct `Content-Type`.
  `express.static` in the esbuild-bundled server returns `text/html` for these files (bundler quirk).
  Replaced with a manual middleware (`server/index-prod.ts:29-39`) that reads files via `fs.readFileSync`
  and sets MIME from a lookup table. Without this, the browser refuses ES module scripts, the React
  app never mounts, and the user sees "Loading celestial chart..." forever.
