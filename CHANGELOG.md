# Changelog

All notable changes. Unreleased entries are uncommitted work in progress.

## [Unreleased] — 2026-08-14

### Feature: "View in Your Space" (WebXR AR + iOS AR Quick Look)
- **Orrery mode** (`#/ar/orrery`): a miniature solar system (8 planets, 9 moons, procedural-noise sun shader, orbit rings, Saturn ring) anchored to a surface via hit-test reticle + tap-to-place; scale toggle (tabletop ~0.5 m / large 2 m), global speed slider, pause; planets/moons are shared InstancedMeshes
- **Focus mode** (`#/ar/<bodyId>`): single body at real GLB resolution (procedural fallback while loading + Suspense), auto-spin, moons on **Keplerian** orbits (real eccentricities, `solveKepler`)
- **Entry points**: "Orrery AR" in the top bar, "View in Your Space" in every body detail modal; PWA manifest `shortcuts` entry `/ar/orrery`
- **iOS / no-WebXR fallback**: dynamic `<model-viewer>` (Google) with `ios-src` USDZ → AR Quick Look; 29 GLBs converted to USDZ (`client/public/models-usdz/`, served from the same jsDelivr CDN under the same commit SHA)
- **USDZ pipeline** (`scripts/export_usdz.mjs`, `convert_usdz.sh`): gltf-transform → Draco decompress → meshopt simplify with **sloppy-collapse fallback** (meshopt's `simplify()` stalls on UV-seamed meshes like ceres) + manual buffer compaction; oversized exports (ceres 57 MB, jwst 26 MB) auto-re-collapsed under the 14 MB cap
- **Bundling**: new `vendor_xr` async chunk for the whole @react-three/xr stack (incl. transitive FontAwesome/devui/styled-components — ~5 MB) so the WebXR code only loads on the AR pages; excluded from workbox precache (`globIgnores`)

### Scene: rendering upgrades
- **Adaptive quality** — new `AdaptiveQuality.tsx` (inside Canvas): drei `PerformanceMonitor` samples real FPS and drives `setDpr` (1.75 → 1.0) on decline, recovering on incline; demand-loop safe (samples only rendered frames)
- **Tone mapping** — Canvas `gl` now uses `ACESFilmicToneMapping` + exposure 1.1 (flows into the postprocessing final pass)
- **Orbit rings** — rebuilt on `LineSegments2`/`LineMaterial` (three-stdlib): WebGL ignores `linewidth > 1`, so the old rings were aliased 1px hairlines; now crisp 1.5px lines, still one merged geometry. Active tour/focus body gets a bright 3px dashed ring in its body color with a slowly scrolling dash (frozen on pause)
- `InstancedStars`: star rotation gated behind `speed > 0 || cinematic` (pause-freeze airtight)

### CDN: GLB models → jsDelivr
- All 29 `*.glb.asset.json` pointers now serve `https://cdn.jsdelivr.net/gh/vodkashot-star/solar-system@<commit-sha>/client/public/models/*.glb` — immutable commit-SHA URLs (tags/branches lag up to 12h on jsDelivr), CORS `*`, `model/gltf-binary` MIME, 7-day client cache; Express no longer serves the ~15 MB of GLBs
- Validators CDN-tolerant: `validate_glb.sh` + `validate_glb_files.py` accept any URL and check the basename (`models:validate` still 29/29)
- `ModelPreview`/`DebugPanel` display model names via `url.split("/").pop()` instead of `/models/` prefix stripping
- Draco WASM stays self-hosted; PWA CacheFirst 30-day GLB caching unchanged (new URL = new cache key)

### Models: recompressed (7 GLBs, Draco)
- cassini, ceres, curiosity, eros, hubble, itokawa, new-horizons recompressed: 15 MB → 7 MB (see `docs/archive/MODEL_OPTIMIZATION_AUDIT.md`); CDN SHA bumped in all pointers
- `client/public/models-backup/` dropped from the repo (gitignored — recoverable from history)

### Deploy: Render blueprint fixes
- `render.yaml`: build command now `npm install --include=dev && npm run build` (env `NODE_ENV=production` made npm skip devDependencies → `vite: not found` on every blueprint-created build)
- `SPACEAI_URL` → `https://solar-system-ml.onrender.com` (Render services are separate containers; `localhost:8000` never resolved)
- Blueprint sync created `solar-system-api` (+ml/bot); live: **https://solar-system-api-ohxd.onrender.com** — health, DB, AI cache, and ML proxy all green
- Old duplicate `solar-system` service retired/suspended

### Docs: reorganization
- Completed improvement reports + stale plans moved to `docs/archive/`: ARCHITECTURE_IMPROVEMENTS, MODEL_OPTIMIZATION_AUDIT, PERFORMANCE_AUDIT, PWA_IMPLEMENTATION, RESPONSIVE_IMPROVEMENTS, WEBGL_PERFORMANCE_IMPROVEMENTS, PLAN_CONTEXT (contained outdated claims — SSE/model-rotation marked done), `thoughts/` (research + plans), `responsive-test.html`
- README: mermaid architecture + AI-cascade diagrams, CDN asset-pointer docs, current Render URL/service table, AdaptiveQuality/OrbitRings structure entries

## [Unreleased] — 2026-08-13

### Visualization: orbit motion + smooth cinematic tour
- `astronomy-positions.ts`: `SIM_SPEED` 0.5 → 1.5 — planets visibly orbit at the default 1x speed (Mercury ~1 min/orbit, Earth ~4 min; outer planets stay slow, as in reality)
- `CinematicTour`: eased target (`smoothedTarget`) between segments — no more 216° arc snap, no dive to origin for unmounted bodies, resume starts from the current camera position; camera damping 0.87 → 1.3 so it settles between bodies
- `Planet`: removed the cinematic Y-bob — bodies sit exactly on their orbit rings (no floating center offset)

### Model: classifier tuned (v18)
- `npm run ai:train -- --tune` (GridSearchCV): CV accuracy **0.8577 ± 0.0483** (was 0.8402 ± 0.0731), held-out test 0.8333; best params `max_depth=3, min_samples_leaf=1, n_estimators=50`
- Snapshot archived at `spaceAI/models/archives/v18/`

### Tooling: opencode config + docs reconciliation
- `opencode.json`: permission `npm run check` → `npm run typecheck` (script was renamed; the allow rule never matched)
- `AGENTS.md`: added PWA service-worker caching, Docker (Express-only), Sentry sourcemap gating, Render production host, and CI (GitHub Actions `validate.yml` gate + Cloudflare Pages `deploy.yml`, branch `Master`) bullets; corrected API base (always relative `/api`, no `VITE_*`), dropped stale `routes.ts` line ref, removed deleted-`.zencode` sync note, added `?model=` studio-preview route + test-typecheck exclusion notes
- `.opencode/techstack.md`: fixed stale claims (`vite-plugin-glsl` not a dependency, Docker = app only, Render/CI infra)
- `.opencode/agents.md`: corrected parallel-agent example names (`frontend`/`backend`/`ml` — `*-agent` variants don't exist)
- Skills reconciled with code: `perf-tuning` (chunk list → 9 vendor chunks incl. `vendor_three_*`/`vendor_fx`/`vendor_state`; GLB budget → ~26 MB on disk), `celestial-design` (`hasRings` → only Saturn/Uranus/Neptune flag it; Jupiter/Haumea defs dormant), `orbit-tuning` (`Fit All` framing verified), `glb-models`/`ai-tuning`/`dev-server-lifecycle`/`frameloop-demand` verified accurate

### Hosting: Netlify removed → Render is the production host
- Deleted `netlify.toml`, `.github/workflows/deploy-netlify.yml`, and `client/public/_redirects` (Netlify SPA fallback — Express serves index.html itself)
- Live: **https://solar-system-0mqx.onrender.com** (from `render.yaml`: Express web + FastAPI ML + Telegram bot worker)
- `render.yaml`: `ALLOWED_ORIGIN` → Render URL; bot worker gains `SOLARIS_API_URL` (Render services are separate — `localhost:5000` wouldn't reach the web service)
- Docs updated (README infra table + deployment section, AGENTS.md `build:cf` description, PWA_IMPLEMENTATION.md comment)

### Perf: performance-metrics bridge (R3F ↔ DOM)
- `usePerformanceMonitor` no longer returns metrics — it is now R3F-only (calls `useThree`/`useFrame`) and must only be invoked inside the Canvas. New `PerformanceMetricsProbe` (rendered inside the Canvas) publishes metrics to `stores/performance.ts` (zustand); `PerformanceMonitor` (DOM overlay) reads the store. Fixes R3F hooks being called from DOM components outside the Canvas.

### Perf: true pause-freeze under `frameloop="demand"`
- New `stores/simulation.ts` mirrors the speed slider. `SunGlow`, `AtmosphereGlow`, `InstancedStars`, and `OrbitalBody` skip `state.invalidate()` when paused (speed 0 and no tour), so the paused scene genuinely freezes instead of glows/stars/offsets continuing to animate.

### Ops: PORT / SPACEAI_PORT env overrides
- Express honors `PORT` (default 5000) and dropped `reusePort` — a stale server on the same port now fails loudly (EADDRINUSE) instead of silently splitting traffic
- FastAPI `run.py serve` defaults its port to the `SPACEAI_PORT` env var (default 8000); must match `SPACEAI_URL` when changed (`.env.example` updated)

### Model: classifier retrained (v17)
- Retrained 2026-08-13; snapshot archived at `spaceAI/models/archives/v17/`

### Feature: PWA support + Web Vitals tracking
- **Progressive Web App**: `vite-plugin-pwa` configured with manifest, service worker, and offline support
  - Manifest: name "Solar System · Cinematic 3D Tour", icons (4 sizes: 192/512 normal + maskable), theme color #070814, standalone display
  - Service worker: auto-update mode, precaches 27 static assets (~2 MB), runtime caching for fonts (1 year), GLB models (30 days), Draco WASM (1 year), API calls (NetworkFirst with 10s timeout)
  - Icons already existed in `client/public/icons/` (pwa-192x192, pwa-512x512, both normal and maskable)
- **Web Vitals tracking**: `client/src/lib/web-vitals.ts` measures Core Web Vitals (CLS, LCP, INP, TTFB, FCP) and sends to Sentry as measurements; poor ratings trigger warning events
  - Note: FID removed (deprecated in web-vitals v4+, replaced by INP)
  - Rating thresholds from web.dev standards (e.g., LCP good < 2.5s, CLS good < 0.1)
- `reportWebVitals()` called on mount in `App.tsx` alongside Draco init
- PWA meta tags added to `index.html`: theme-color, apple-mobile-web-app-* tags, apple-touch-icon, enhanced Open Graph with image
- Installable on desktop (Chrome/Edge install prompt) and mobile (iOS "Add to Home Screen", Android install banner)
- Offline functionality: precached JS/CSS/HTML loads instantly, GLB models cached on first visit
- `PWA_IMPLEMENTATION.md` verification guide created (build checklist, testing steps, Lighthouse audit, expected metrics)

### Feature: Telegram bot (SOLARIS Network)
- `spaceAI/telegram_bot.py` — python-telegram-bot polling app: `/start` + free-text chat routed to location-based station AIs (A.R.E.S. Flight Command @ Earth, Dr. Vance @ Lunar Gateway, Deep-Space Drone 09 @ Makemake) via OpenCode Zen (`deepseek-v4-flash-free`); markdown-fallback + error handling built in; run with `TELEGRAM_BOT_TOKEN` + `OPENCODE_API_KEY`
- Deps into `spaceAI/venv`: `python-telegram-bot` 22.8, `openai` 3.0.0
- `npm run ai:bot` script added (`cd spaceAI && ./venv/bin/python telegram_bot.py` — venv python, since plain `python` has no deps)
- IPv4-first `socket.getaddrinfo` patch in the bot: box has no IPv6 route but DNS prefers AAAA — without it Telegram rejects the (valid) token
- `.env.example` template added (placeholder values — committable; real secrets stay in gitignored `.env`)
- Bot error handling reworked: rate-limit/429 failures reply "Relay Busy" flavor text; other failures reply "*Signal lost with {station}... Error:*" instead of crashing the handler
- DB schema: `player_characters` + `chat_logs` tables (FK to `celestial_bodies.id` — typed `integer`, text FK would not match the serial PK) in `shared/schema.ts`, migration `drizzle/0004_mushy_kylun.sql` pushed to Neon
- Branch: `feature/telegram-bot` (unpushed)

### Feature: Telegram bot — DB wiring + model failover
- **Location-based routing is live**: station decided by `player_characters.current_body_id` (joined to `celestial_bodies.name`); unregistered/unknown players default to Earth/A.R.E.S.
- `/start` auto-registers the player (name from Telegram profile, reputation 0, stationed at Earth — the row is auto-seeded if missing); returning players get a "welcome back" greeting
- **Full chat persistence**: every user message + AI reply logged to `chat_logs` (is_ai flag, station body FK, character name sender)
- Persistence via `psycopg2` (already in venv) with a shared connection + reconnect-once on `OperationalError`; **fail-silent** — no `DATABASE_URL` or DB outage can crash the bot (chat still works, routing falls back to Earth)
- **Rate-limit failover**: 429/`FreeUsageLimitError` now retries `deepseek-v4-flash-free` → `nemotron-3-ultra-free` (override via `OPENCODE_FALLBACK_MODEL`) before the "Relay Busy" flavor text
- `print(..., flush=True)` so daemon logs (`/tmp/aibot.log`) show the boot line through the nohup pipe

### Bug fix: `feature_importances()` unwrapped the forest into an unfitted template
- `spaceAI/src/predict.py` ran `getattr(clf, "estimator", clf)` on every model — RandomForestClassifier also exposes `.estimator` as an **unfitted** base-tree template, so importance extraction returned `None` and `test_feature_importances_not_none` failed. The unwrap now only applies when the inner model is actually fitted (has `feature_importances_`/`coef_`); forests keep their own fitted attributes.

### Docs: full markdown refresh
- README.md: Telegram bot section, custom bodies + cinematic grade + real-orbit features, ai:* script list (185 tests), corrected tree (Postgres drizzle migrations 0000–0004, `telegram_bot.py`, venv, no `functions/`/alembic), setuptools stack (Poetry/Alembic removed)
- AGENTS.md: DB table list gained `player_characters` + `chat_logs`; new "Telegram Bot (SOLARIS Network)" section (stations, model, .env, IPv4 patch, daemon + pgrep footgun)
- spaceAI/README.md: venv-first quick start + npm wrappers (ai:cv, ai:bot, ai:check), Postgres/queue corrections flow, new Telegram Bot section, `telegram_bot.py` in components
- spaceAI/docs/troubleshooting.md: corrections persistence + Telegram bot section (Invalid token = missing .env, IPv4, Relay Busy, daemon restart)
- `thoughts/`: AUDIT.md counts + last-updated bumped; shipped plans (`astronomy-engine`, `spaceai-v2`, `spaceai-ensemble-active-learning`) get Status headers; perf docs get status notes
- `.opencode/techstack.md` + `agent/ml.md`: Poetry → setuptools/venv, bot stack added

### Feature: cinematic visual grade
- New `FilmGrainOverlay` (pure CSS DOM overlay): animated SVG-noise film grain (`mix-blend-mode: overlay`, `steps()` shimmer) + soft radial vignette — zero GPU cost, sits under the UI (`client/src/components/solar-system/FilmGrainOverlay.tsx`, `index.css`)
- Sun god-rays: additive billboard shafts behind the sun, slowly tilting while the cinematic tour is enabled (`SunGlow.tsx`, tour-only via `useCinematicMode`)
- Second nebula band tilted across the sky for galactic depth — the 512px fbm texture is now a session singleton shared by all bands, so a second layer costs nothing (`NebulaBackground.tsx`, `SolarSystem.tsx`)

### Perf: three.js chunk split + preload
- `three` + `three-stdlib` split into their own `vendor_three` chunk (accompanies the lazy SolarSystem chunk in the import graph) — `vendor_shared` dropped **1026 kB → 249 kB**
- New `preloadThreeChunk` Vite plugin injects `<link rel="modulepreload">` for the hashed `vendor_three` asset into the built `index.html`, so the 776 kB module downloads in parallel with the entry bundles instead of after the lazy import fires (`vite.config.ts`)

### Perf: curiosity.glb 8.36 MB → 2.95 MB (−65%)
- Rebuilt with `gltf-transform jpeg --formats "*"` quality 82 + re-applied Draco after decode
- 8× 1024px PNG color textures → JPEG (~120–230 kB each); alpha texture + normal map correctly kept as PNG; mesh stays Draco-compressed (`client/public/models/curiosity.glb`)
- All 29 models still validate clean (`npm run models:validate`)

### Bug fix: keyboard navigation + duplicate spacecraft + LOD re-render storm
- `useKeyboardNavigation` now takes `bodies` (was static `BODIES` with an `allBodies` index — arrow keys hit the wrong body / skipped custom bodies)
- Spacecraft with a `parentBody` (curiosity, cassini, hubble, apollo-lm, juno-spacecraft, dragonfly) matched **both** the `moons` and `spacecraft` groupings and rendered twice at different orbit radii; moons grouping now excludes spacecraft (`SolarSystem.tsx`)
- New `useLODRef` hook: LOD distance input lives in a mutable ref updated from `useFrame` — only threshold crossings `setState`, killing the per-frame re-render storm across all ~40 planets (`lib/lod-manager.ts`, `Planet.tsx`)

### Feature: Fit All overview + cleaner cinematic framing
- New **Fit All** button (top bar): flies the camera out to frame the whole system on screen, auto-clears back to OrbitControls. Bounding sphere computed from live positions + radii so custom bodies / scale modes are honored (`FocusCamera.tsx`, `stores/camera-focus.ts`)
- `camera-focus` store gained `fitAll` + `fit()`; focus cancels fit and vice versa; 3 new store tests
- Cinematic tour overview now frames at a fixed distance clearing the outermost orbit (was `80 − t·10`, dipping below Sedna's orbit and sweeping through the orbit lines — messy); tour pauses while fitAll is active
- Orbit rings dim from opacity 0.2 → 0.07 during overview/fitAll (`OrbitRings` `dimmed` prop) to reduce clutter


### Feature: custom bodies from the catalog API
- `celestial_bodies` gained scene-rendering columns (`visual_radius`, `orbit`, `orbit_speed`, `spin_speed`, `tilt`, `phase`, `color`, `fact`, `parent_body`, `has_rings`) via `drizzle/0003_plain_jean_grey.sql` (pushed)
- Client: `lib/custom-bodies.ts` (DB row → `Body` mapping with earth-scale scene defaults, silent-fail fetch/create/delete), `hooks/useCustomBodies.ts`
- `SolarSystem` merges `allBodies = BODIES + customBodies`; `OrbitRings`, `CinematicTour`, `BodySearch`, `FocusCamera` accept a `bodies` prop
- "+ Add" button → `CustomBodyModal` (POST `/api/bodies`); Remove button on custom bodies in the detail modal (DELETE)
- Seeded demo bodies: Kepler-442b (super-Earth) + Halley-comet
- 6 new unit tests (`client/src/test/custom-bodies.test.ts`) — 182 total
- Note: custom bodies need the Express API + Postgres — static hosts (surge) degrade gracefully ("API unreachable")

### Cleanup (prune)
- Removed 6 duplicate `.glb.asset.json` manifests from `client/public/models/` (canonical copies live in `client/src/assets/solar/`)
- Removed 8 stray conversion textures (`cassini.glb_*.png`, `hubble.glb_*.png`, ~3 MB)
- Removed `.opencode/node_modules` (63 MB), `.zencode/` legacy config copy, `stats.html` build artifact
- Dropped unused `playwright` devDependency (reinstalled `--no-save` on 2026-08-03 for stuck-loading debug; remove when done)
- Dep bumps (in-major, non-breaking): `tsx` 4.23.5, `vitest` 4.1.10, `happy-dom` 20.11.1, `autoprefixer` 10.5.4, `@types/node` 24.13.3
- `surge` kept as devDependency for hosting

### Refactor
- Merged `MoonOrbit.tsx` + `SpacecraftOrbit.tsx` → `OrbitalBody.tsx`: moons use `body.orbit`, spacecraft pass an `orbitRadius` override
- New shared `client/src/lib/glow-textures.ts` (`makeGlowTexture`, `hexToRgba`) — deduped canvas/gradient boilerplate in `SunGlow` + `AtmosphereGlow`
- Docs synced: AGENTS.md, README.md, orbit-tuning skill, bodies.ts comment

### Hosting
- New `npm run deploy:surge` script: static build (`build:cf`) + `surge dist/ solar-system-3d.surge.sh`
- Deployed live: **https://solar-system-3d.surge.sh** (48 files, 33 MB)
- Note: old `solar-system.xyz` custom domain and `solar-system.surge.sh` are registered to other surge accounts — not publishable from `jnx3316@gmail.com`

### Bug fix (deployed)
- **Stuck "Loading celestial chart…" splash on static hosts — FIXED.** Root cause: `manualChunks` matched `id.includes('react')`, which swept `@react-three/*` + `react-spring` into `vendor_react`; those import `three` (in `vendor_shared`), creating a `vendor_react ↔ vendor_shared` circular chunk. ESM circular evaluation broke react-dom's hook init (`useLayoutEffect` undefined) → entry module crashed before React mounted. Fix in `vite.config.ts`: `vendor_react` now matches only `react|react-dom|scheduler`. Verified boot on `dist/` static server + live surge (headless chromium: UI renders, canvas up, 0 page errors).
- Debug session used a temporary `playwright --no-save` + headless chromium; removed afterwards (package.json untouched).
