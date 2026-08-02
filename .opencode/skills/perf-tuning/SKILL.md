---
name: perf-tuning
description: Use when tuning performance or diagnosing slowness/loading stalls in the solar-system app — boot hangs, "stuck loading", low FPS, large bundle sizes, slow API responses. Covers the A–F optimization playbook (lazy GLB loading, spinner unblock, bloom gating, gzip, AI cache), measurement commands, and payload budgets.
---

# Perf Tuning

Reference playbook for the perf pass (commits `35b6cd4..b75d323`). When asked to
make the app faster, first **measure**, then apply the levers below.

## Boot-time blockers (check these first)

1. **AI API latency** — the historic boot blocker was Neon DB (~1.5s/query) on
   every AI request before the file-cache fallback. Fixed by `getMergedAICache()`
   in `server/routes.ts`: DB → `spaceAI/data/ai_cache.json` → static merge with
   60s TTL. If boot is slow again, check `/api/ai/precomputed` timing:
   `curl -s -o /dev/null -w "%{time_total}s\n" http://localhost:5000/api/ai/precomputed`
   Expect <100ms. A ~1.5s response = TTL expiry mid-merge (acceptable, one-off)
   or a regression (cache bypass).
2. **GLB payloads** — 29 GLBs in `client/public/models/`. Total budget now
   ~<15MB after the slim pass. Big models: sun/uranus (textured), cassini,
   curiosity, hubble (textures embedded). See `glb-models` skill for slimming.
3. **Draco** — every GLB must be Draco-compressed (validate: `npm run models:validate`).
   Missing Draco wasm = models fail to load: run `scripts/copy-draco.sh` before dev.

## Client levers (A/B/E)

- **Lazy GLB loading** — `Planet.tsx` mounts the GLB only when
  `body.glbUrl && isWanted && everWanted`. `wantedIds` Set in `SolarSystem.tsx`
  includes: tourOn+active, focusTarget, hoveredBodyId, detailBodyId. Never
  revert to eager GLB loading of all 29 models.
- **Prefetch** — next 3 tour GLBs prefetched via `requestIdleCallback` +
  `useGLTF.preload` in `SolarSystem.tsx` (deps `[tourOn, active]`).
- **Spinner unblock** — `LoadingSpinner.tsx` hides on first body load/error or
  5s cap, whichever first. A stuck spinner means no body ever resolved — check
  network, not the spinner.
- **Bloom gating** — `EffectComposer`/`Bloom` render only when
  `(tourOn || isFocused)` (`SolarSystem.tsx`). Post-processing costs real GPU
  time; never enable it unconditionally for the whole scene.
- **frameloop="demand"** — every `useFrame` must call `state.invalidate()` or
  the scene freezes. See `frameloop-demand` skill. Always audit new
  useFrame callbacks.

## Server levers (D/F)

- **Cache-Control** — `/api/ai/precomputed` and `/api/ai/classify/:bodyId` set
  `public, max-age=60` (`server/routes.ts`). Cache-invalidation on correction
  is mandatory (correction → clear merged cache).
- **gzip** — `compression` middleware in `server/app.ts`, threshold 1024,
  filter skips `model/gltf` + `image/*`. Verify:
  `curl -s -D- -H "Accept-Encoding: gzip" http://localhost:5000/assets/<file> | grep -i content-encoding`
- **DB timeouts** — `server/db.ts`: `connect_timeout: 2, idle_timeout: 5,
  max_lifetime: 600`. If DB is down, the app must still boot (file cache).

## Measuring

- Endpoint timing: `curl -s -o /dev/null -w "%{time_total}s\n" <url>`
- HTTP headers: `curl -s -D- -o /dev/null <url>`
- Network payload: browser DevTools Network tab, filter `glb` — count MB
- Bundle: `stats.html` is a rollup-plugin-visualizer artifact (gitignored);
  rebuild with `npm run build` and open it. Chunks: `vendor_react`,
  `vendor_shared`.
- FPS: only meaningful with bloom active (tour/focus) on the target device.

## Regression gates

After any perf change: `npm run check` (tsc 0 errors), `npm test` (176),
`npm run models:validate` (29/29 valid), and a curl timing pass on
`/api/ai/precomputed` (<100ms) + one cold `classify` after TTL expiry.
