# CosmicVoyage — Code Audit
**Date:** 2026-07-02 · **Last updated:** 2026-07-04
**Scope:** Full source audit of `client/src/`, `server/`, `shared/`, `spaceAI/`
**TypeScript check:** `npm run check` passes with 0 errors (excluding known `shared/schema.ts` drizzle issue)

---

## Severity Legend

| Label | Meaning |
|-------|---------|
| 🔴 Bug | Causes incorrect behavior at runtime |
| 🟠 Risk | Security or data-integrity concern |
| 🟡 Minor | Wasteful / incorrect but not breaking |
| 🔵 Smell | Code quality, maintainability |
| ⚪ Info | Known / documented, no action needed |

---

## 1 · Runtime Bugs

### ✅ BUG-01 — `InstancedStars` missing `invalidate()` — **FIXED**

**File:** `client/src/components/solar-system/InstancedStars.tsx`

`state.invalidate()` is now called inside `useFrame`. Stars animate correctly with `frameloop="demand"`.

---

### ✅ BUG-02 — `FocusCamera` flies to stale position — **FIXED**

**File:** `client/src/components/solar-system/FocusCamera.tsx`

`FocusCamera` now reads `positions.current[targetBodyId]` every frame inside `useFrame`. Auto-clears after 30 settled frames. Camera always tracks the live planet position.

---

### ✅ BUG-03 — Side effect inside `useMemo` in `GLBModel` — **FIXED**

**File:** `client/src/components/solar-system/Planet.tsx`

`startLoad()` moved to a `useEffect`. No more side effects in `useMemo`.

---

## 2 · Security

### ⚠️ SEC-01 — CORS origin — **PARTIALLY FIXED / DEGRADED**

**File:** `server/app.ts`

The wildcard `*` CORS was replaced with the `cors` package using `ALLOWED_ORIGIN` env var. However, the default when `ALLOWED_ORIGIN` is unset is `false`, which blocks **all** cross-origin requests. In dev this works (same-origin), but in production (CF Pages serving from a custom domain) the Express API will silently return CORS errors unless `ALLOWED_ORIGIN` is set in the environment.

**Action needed:** Set `ALLOWED_ORIGIN=https://your-domain.com` in the production environment (Render/Railway/Fly.io dashboard or `.env`). Or default to `"*"` in dev and restrict only in prod:
```ts
origin: process.env.NODE_ENV === "production"
  ? (process.env.ALLOWED_ORIGIN ?? "*")
  : "*"
```

---

## 3 · Memory / Performance

### ✅ PERF-01 — `FallbackSphere` material leak — **FIXED**

**File:** `client/src/components/solar-system/Planet.tsx`

`getFallbackMaterial()` now caches all materials via a `Map`. No more per-mount leaks.

---

### 🟡 PERF-02 — `OrbitRings` geometry rebuilt on every `scaleMultiplier` change — **OPEN**

**File:** `client/src/components/solar-system/OrbitRings.tsx`

The `useMemo` that builds the merged `BufferGeometry` depends on `scaleMultiplier`. Every scale toggle re-computes all orbit ellipses and re-uploads to GPU. The orbit ellipses themselves don't change — only the radii scale. Pre-computing at scale=1 and applying a uniform scale transform would eliminate this.

---

### 🟡 PERF-03 — `makeNebulaTexture` blocks main thread — **MITIGATED**

**File:** `client/src/components/solar-system/NebulaBackground.tsx`

Default texture size reduced to 512×512 (was 1024). Stall reduced but still present on low-end devices. Full fix: offload to a `Worker`.

---

## 4 · Code Quality / Smells

### ✅ SMELL-01 — Suppressed exhaustive-deps — **FIXED**

**File:** `client/src/components/solar-system/SolarSystem.tsx`

`aiCache` now correctly included in dep array with early-return guard.

---

### 🔵 SMELL-02 — `scaleMode` has 4 values, UI only documents 2 — **OPEN**

**File:** `SolarSystem.tsx`, `ScaleControl.tsx`

`"hybrid"` and `"realSize"` multipliers (0.6, 0.35) produce intermediate scales with no UI labels. Minor UX confusion.

---

### ✅ SMELL-03 — Unused `saturation`/`speed` props in `InstancedStars` — **FIXED**

Removed from the props type.

---

### ✅ SMELL-04 — Dead files `queryClient.ts` and `use-is-mobile.tsx` — **FIXED**

Both deleted.

---

## 5 · Cross-Cutting Issues

### 🔴 CRASH-01 — `throw err` in Express error handler — **OPEN**

**File:** `server/app.ts:75`

```ts
app.use((err, _req, res, _next) => {
  res.status(status).json({ message });
  throw err;  // ← can crash the Node process
});
```

Should be `console.error(err)` or simply removed. Throwing from an Express error handler propagates an unhandled rejection.

---

### 🟠 CI-01 — Branch name mismatch — **OPEN**

- `deploy.yml` triggers on `branches: [Master]`
- `validate-data.yml` triggers on `branches: [main]`

Align to the repo's actual default branch.

---

### 🟠 CI-02 — `validate-data.yml` missing TypeScript + vitest steps — **OPEN**

The validation workflow only runs Python tests. Add `npm run check` and `npm test` to catch frontend regressions before merge.

---

### 🟡 DEP-01 — `@tanstack/react-query` unused — **OPEN**

`queryClient.ts` was deleted but the package remains in `dependencies`. No imports found. Remove from `package.json` and clean up bundle.

---

### 🟡 PY-01 — `pyproject.toml` references Poetry build backend — **OPEN**

The project uses pip/requirements.txt. The Poetry reference is inert but misleading for contributors.

---

## 6 · Known / Documented Issues (no action needed)

| ID | File | Note |
|----|------|------|
| ⚪ INFO-01 | `shared/schema.ts` | TS errors from drizzle-orm PG types — `@neondatabase/serverless` not installed. Does not affect frontend build. |
| ⚪ INFO-02 | `stats.html` | Build artifact from `rollup-plugin-visualizer` — gitignored. |
| ⚪ INFO-03 | `.env*` | Gitignored — create `server/.env.local` etc. for local overrides. |
| ⚪ INFO-04 | `shared/schema.ts` | `celestialBodies` and `celestialObservations` tables have no Python counterpart — forward-looking schema. |

---

## 7 · Cloudflare Pages

### ✅ CLOUD-01 — `wrangler-action@v3` `apiToken` propagation — **FIXED**

`env.CLOUDFLARE_API_TOKEN` now set in deploy step. Node bumped to 22.

### 🟡 CLOUD-02 — No production host for the Express API server — **OPEN**

CF Pages serves only the static client. Express has no production deployment. Options: Render (free tier), Railway ($5/mo), Fly.io (free tier), Cloudflare Workers (100k req/day free).

---

## 8 · Fix Priority

| Priority | ID | Status | Effort |
|----------|----|--------|--------|
| 1 | CRASH-01 | Open | 1 line — remove `throw err` |
| 2 | SEC-01 | Degraded | Set `ALLOWED_ORIGIN` in prod env |
| 3 | CI-01 | Open | Align branch names |
| 4 | CI-02 | Open | Add `npm run check` + `npm test` to validate-data.yml |
| 5 | PERF-02 | Open | ~15 lines — scale uniform instead of geometry rebuild |
| 6 | PERF-03 | Mitigated | ~50 lines — Worker offload |
| 7 | DEP-01 | Open | Remove `@tanstack/react-query` from package.json |
| 8 | SMELL-02 | Open | Add UI labels for hybrid/realSize scale modes |
