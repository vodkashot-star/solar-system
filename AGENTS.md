# AGENTS.md — Solar System

## Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Frontend + Express dev server (:5000) — **no AI service** |
| `npm run dev:full` | Full stack: Express (:5000) + FastAPI (:8000) via `scripts/dev.sh` |
| `npm run check` | `tsc` — 0 expected errors |
| `npm test` | `vitest run` — 152 tests (2 files, parameterized) |
| `npm run test:watch` | `vitest` in watch mode |
| `npm run build` | `copy-draco.sh && vite build && esbuild server` → `dist/` |
| `npm run build:cf` | CF Pages static build (Draco → vite build → `dist/`) |
| `npm start` | Production: `node dist/index-prod.js` (build first) |
| `npm run models:convert` | Convert a NASA OBJ model → Draco GLB (see NASA Model Pipeline below) |
| `npm run models:validate` | Cross-reference GLBs against ML classification |
| `npm run models:generate` | Regenerate procedural GLB models via Blender (requires Blender 3.4+) |
| `npm run models:downscale` | Downscale heavy GLBs for mobile |
| `npm run ai:train` | Train classifier (`--tune` for GridSearchCV) |
| `npm run ai:train-regression` | Train mass + temp regressors |
| `npm run ai:train-all` | Both train commands sequentially |
| `npm run ai:test` | pytest — 46 tests in `spaceAI/tests/` |
| `npm run ai:serve` | Start FastAPI on :8000 |
| `npm run db:push` | Push Drizzle schema to PostgreSQL (Neon) |
| `npm run db:generate` | Generate Drizzle migration |
| `npm run db:studio` | Drizzle Studio UI |

## Architecture — SPA, no SSR

- **Entry**: `client/index.html` → `main.tsx` → lazy `SolarSystem`
- **Canvas `frameloop="demand"`** — every `useFrame` **must** call `state.invalidate()` or the scene freezes
- **Path aliases**: `@/*` → `client/src/*`, `@shared/*` → `shared/*`
- **GLB asset pointers**: `.glb.asset.json` files contain `{"url":"/models/<name>.glb"}` — CDN swap = edit JSON only
- **Draco decoder**: `client/src/lib/draco-setup.ts` wires `useGLTF.setDRACOLoader()`; WASM auto-copied on build
- **Loading**: `LoadingSpinner` tracks bodies via `load-debugger`; hides on all-loaded or 15s timeout
- **Tour**: 5s per body (~1.5s fly-in, ~3s arc, ~0.5s pull-back), cycles all bodies including spacecraft. Camera arc = 1.2π radians (~216°)
- **Camera focus**: `FocusCamera` reads `positions.current[targetBodyId]` every frame in `useFrame` — always tracks live body position
- **Keyboard shortcuts**: `Space` toggle tour, `←`/`→` prev/next body, `/` open search, `Esc` close modals/clear focus
- **Body search**: Press `/` or click "Search" button — type to filter all bodies by name, select to focus
- **Server proxy**: Express `/api/ai/*` → `SPACEAI_URL` (default `:8000`), 10s timeout, in-memory cache with 5min TTL
- **Cloudflare Functions**: `functions/api/ai/classify/[bodyId].js` mirrors the proxy for CF Pages deploy. SPA fallback: `client/public/_redirects`
- **Docker**: `docker-compose up` → `spaceai` (:8000) + `app` (:5000). `SPACEAI_URL=http://spaceai:8000` in container
- **Frontend works without spaceAI**: AI fetch failures silently caught; scene renders, tour runs, GLBs load. AI features (classification panel, similar bodies) are absent but nothing crashes.

## Body Types

| Type | Color | Description |
|------|-------|-------------|
| `star` | gold | The Sun |
| `planet` | blue | 8 solar system planets |
| `dwarfPlanet` | orange | Pluto, Ceres, Eris, etc. |
| `asteroid` | grey | Bennu, Eros, Psyche, etc. |
| `comet` | green | Halley's Comet |
| `interstellar` | purple | ʻOumuamua |
| `spacecraft` | teal | NASA missions (Curiosity, Cassini, Hubble, Voyager, Apollo LM) |

Spacecraft carry two extra optional fields on `Body`:
- `parentBody?: string` — ID of the body they orbit (e.g. `"mars"`). Spacecraft without a `parentBody` orbit the Sun like any other body.
- `missionInfo?: MissionInfo` — `{ agency, launched, target, status, description }`. Rendered as a Mission Info card in `BodyDetailModal`.

## Spacecraft Orbit

`SpacecraftOrbit.tsx` wraps `Planet` with a per-frame position offset:
- Each frame it adds a small circular displacement (radius ~1.5–2× parent visual radius) to `parentPosition`
- The resulting world position is passed to `Planet` via a ref, so `FocusCamera` and `LoadingSpinner` track it correctly
- Parent positions come from `positions.current` in `SolarSystem.tsx` — the same ref used for camera focus
- `SpacecraftOrbit` calls `state.invalidate()` every frame (required for `frameloop="demand"`)

## NASA Model Conversion Pipeline

NASA 3D Resources (https://github.com/nasa/NASA-3D-Resources) ships OBJ + MTL + texture files. The `models:convert` script converts them to Draco-compressed GLB:

```bash
npm run models:convert -- "<path/to/model.obj>" <output-name>
# Example:
npm run models:convert -- "NASA-3D-Resources/3D Models/Curiosity Rover (MSL)/curiosity.obj" curiosity
# → client/public/models/curiosity.glb
```

Steps performed by `scripts/convert_nasa_model.sh`:
1. `obj2gltf` — OBJ + MTL + textures → raw GLB (dev dep, already installed)
2. `gltf-transform optimize` — Draco compression + texture resize to 1024px
3. `gltf-transform validate` — sanity check

After conversion, create `client/src/assets/solar/<name>.glb.asset.json`:
```json
{ "url": "/models/<name>.glb" }
```
Then add the body entry to `bodies.ts` and run `npm run check`.

## spaceAI (Python ML microservice)

- 11 features: `orbital_period`, `axial_tilt`, `mass`, `radius`, `eccentricity`, `density`, `gravity`, `temperature`, `semi_major_axis`, `inclination`, `rotation_period`
- Classifiers: RF (default), SVC, LogisticRegression via `--model-type`; `--tune` for GridSearchCV
- CLI entry: `spaceAI/run.py`. All `npm run ai:*` scripts delegate via `cd spaceAI && python run.py <cmd>`
- Precomputation: all bodies classified at FastAPI startup (lifespan handler), persisted in DB
- **Spacecraft classification**: spacecraft entries in `spaceAI/data/celestial_objects.csv` use `body_type = spacecraft`. If the AI service is offline, the frontend shows a static "Human-made spacecraft" fallback in the classification panel.
- **Database**: `SPACEAI_DATABASE_URL` for PostgreSQL (Neon), falls back to `sqlite:///data/spaceai.db` locally. SQLAlchemy + Alembic in `spaceAI/alembic/`
- DB tables: `ai_cache` (precomputed classifications) and `prediction_logs` (regression history)
- `shared/schema.ts` mirrors these as Drizzle `pgTable` — requires PG env for `drizzle-kit push`; TS errors when PG types not installed
- Model files: `spaceAI/models/` — `celestial_classifier.pkl`, `mass_regressor.pkl`, `temperature_regressor.pkl`
- Tests: `spaceAI/tests/` — 46 pytest. Run via `npm run ai:test` or `cd spaceAI && python -m pytest tests/ -v`
- The test module seeds cache at module level in `tests/test_api.py` via `precompute_all()`
- Dockerfile trains model at build time (`RUN python src/train_model.py`) — keep this path if refactoring training
- Dependencies in `requirements.txt` + `requirements-dev.txt` (pytest, httpx)

## CI / Deploy

- **`deploy.yml`**: On push to `Master` — `npm ci && npm run build:cf && wrangler pages deploy` to CF Pages
  - Requires `CLOUDFLARE_API_TOKEN` (needs `Cloudflare Pages > Edit` + `Account Settings > Read` perms) and `CLOUDFLARE_ACCOUNT_ID` as repo secrets
  - Node 22
- **`validate-data.yml`**: On push/PR to `Master` — taxonomy validation + AI training (classifier + regression) + pytest + TypeScript check + vitest client tests
- **Cloudflare Pages serves only the static client** — the Express API server has no production host (see CLOUD-02 in `thoughts/AUDIT.md`)
- **No `wrangler.toml`** — configured via dashboard + `wrangler-action@v3`

## Known Issues

- All 3 critical bugs from `thoughts/AUDIT.md` (BUG-01, BUG-02, BUG-03) are **fixed** — see the audit for details
- `shared/schema.ts` has TS errors (drizzle-orm PG types not installed) — does not affect frontend build
- `stats.html` is build artifact from `rollup-plugin-visualizer` — gitignored
- `.env*` files are gitignored — create your own `server/.env.local` etc. for env overrides

## Conventions

- Package manager is **npm**.
- `dist/` is gitignored build output
- `node_modules/` is gitignored
- `scripts/` — shell scripts for build steps (copy-draco, downscale textures, dev stack, NASA model conversion)
- Blender GLB generation scripts require Blender 3.4+
- Update all `.md` files when changing code/docs — consistency across README, AGENTS, and `thoughts/` files
