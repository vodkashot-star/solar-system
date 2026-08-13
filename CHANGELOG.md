# Changelog

All notable changes. Unreleased entries are uncommitted work in progress.

## [Unreleased] — 2026-08-13

### Feature: Telegram bot (SOLARIS Network)
- `spaceAI/telegram_bot.py` — python-telegram-bot polling app: `/start` + free-text chat routed to location-based station AIs (A.R.E.S. Flight Command @ Earth, Dr. Vance @ Lunar Gateway, Deep-Space Drone 09 @ Makemake) via OpenCode Zen (`deepseek-v4-flash-free`); markdown-fallback + error handling built in; run with `TELEGRAM_BOT_TOKEN` + `OPENCODE_API_KEY`
- Deps into `spaceAI/venv`: `python-telegram-bot` 22.8, `openai` 3.0.0
- `npm run ai:bot` script added (`cd spaceAI && ./venv/bin/python telegram_bot.py` — venv python, since plain `python` has no deps)
- IPv4-first `socket.getaddrinfo` patch in the bot: box has no IPv6 route but DNS prefers AAAA — without it Telegram rejects the (valid) token
- `.env.example` template added (placeholder values — committable; real secrets stay in gitignored `.env`)
- DB schema: `player_characters` + `chat_logs` tables (FK to `celestial_bodies.id` — typed `integer`, text FK would not match the serial PK) in `shared/schema.ts`, migration `drizzle/0004_mushy_kylun.sql` pushed to Neon
- Branch: `feature/telegram-bot` (unpushed)

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
