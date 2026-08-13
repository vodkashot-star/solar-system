# CosmicVoyage — Code Audit
**Date:** 2026-07-02 · **Last updated:** 2026-08-13
**Scope:** Full source audit of `client/src/`, `server/`, `shared/`, `spaceAI/`
**TypeScript check:** `npm run check` passes with 0 errors (excluding known `shared/schema.ts` drizzle issue)
**Frontend tests:** `npm test` — 185/185 pass
**AI tests:** `npm run ai:test` — 50/50 pass

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

### ✅ BUG-04 — `throw err` in Express error handler — **FIXED**

**File:** `server/app.ts:75`

Was throwing from Express error handler, risking unhandled rejection. Replaced with `console.error(err)`.

---

### ✅ BUG-05 — `@tanstack/react-query` unused dependency — **FIXED**

Package was listed in `dependencies` with zero imports. Removed in dependency prune commit `471939e`.

---

## 2 · Security

### ✅ SEC-01 — CORS origin — **FIXED**

**File:** `server/app.ts`

The wildcard `*` CORS was replaced with the `cors` package using `ALLOWED_ORIGIN` env var. Defaults to `"*"` when unset (safe for dev/same-origin). In production, set `ALLOWED_ORIGIN=https://your-domain.com` to restrict.

---

## 3 · Memory / Performance

### ✅ PERF-01 — `FallbackSphere` material leak — **FIXED**

**File:** `client/src/components/solar-system/Planet.tsx`

`getFallbackMaterial()` now caches all materials via a `Map`. No more per-mount leaks.

---

### ✅ PERF-02 — `OrbitRings` geometry rebuilt on every `scaleMultiplier` change — **FIXED**

**File:** `client/src/components/solar-system/OrbitRings.tsx`

`useMemo` dependency was `[scaleMultiplier]`. Now uses `[]` with `<group scale={scaleMultiplier}>` wrapping the geometry, so the geometry is built once and only the transform changes.

---

### 🟡 PERF-03 — `makeNebulaTexture` blocks main thread — **MITIGATED**

**File:** `client/src/components/solar-system/NebulaBackground.tsx`

Default texture size reduced to 512×512 (was 1024). Stall reduced but still present on low-end devices. Full fix would offload to a `Worker` (~50 lines). Not critical — texture is generated once on mount.

---

## 4 · Code Quality / Smells

### ✅ SMELL-01 — Suppressed exhaustive-deps — **FIXED**

**File:** `client/src/components/solar-system/SolarSystem.tsx`

`aiCache` now correctly included in dep array with early-return guard.

---

### ✅ SMELL-02 — `scaleMode` has 4 values, UI only documents 2 — **FIXED**

**File:** `ScaleControl.tsx`

All 4 scale modes now have explicit labels and descriptions in the `ScaleControl` component.

---

### ✅ SMELL-03 — Unused `saturation`/`speed` props in `InstancedStars` — **FIXED**

Removed from the props type.

---

### ✅ SMELL-04 — Dead files `queryClient.ts` and `use-is-mobile.tsx` — **FIXED**

Both deleted.

---

## 5 · Cross-Cutting Issues

### ✅ CRASH-01 — `throw err` in Express error handler — **FIXED**

**File:** `server/app.ts:75`

Was `throw err` which could crash the Node process. Replaced with `console.error(err)`.

---

### ✅ CI-01 — Branch name mismatch — **FIXED**

Both `deploy.yml` and `validate-data.yml` now trigger on `branches: [Master]` (capital M), matching the repo's default branch.

---

### ✅ CI-02 — `validate-data.yml` missing TypeScript + vitest steps — **FIXED**

**File:** `.github/workflows/validate-data.yml`

Added `npm run check` (TypeScript) and `npm test` (vitest) steps after the Python test suite.

---

### ✅ DEP-01 — `@tanstack/react-query` unused — **FIXED**

Package removed from `dependencies` in `package.json`. Zero imports in codebase.

---

### ✅ PY-01 — `pyproject.toml` references Poetry build backend — **FIXED**

**File:** `spaceAI/pyproject.toml`

Replaced Poetry-specific sections with standard setuptools build backend. Dependencies migrated from `[tool.poetry.dependencies]` to `[project.dependencies]`. Dev dependencies use `[project.optional-dependencies]`.

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
| 1 | CRASH-01 | Fixed | `throw err` → `console.error(err)` |
| 2 | SEC-01 | Fixed | CORS defaults to `*` when unset |
| 3 | CI-01 | Fixed | All workflows trigger on `Master` |
| 4 | CI-02 | Fixed | `npm run check` + `npm test` added |
| 5 | PERF-02 | Fixed | Scale transform instead of geometry rebuild |
| 6 | PERF-03 | Mitigated | ~50 lines — Worker offload (deferred) |
| 7 | DEP-01 | Fixed | Removed from `package.json` |
| 8 | SMELL-02 | Fixed | All 4 modes have labels/descriptions |
| — | PY-01 | Fixed | Poetry → setuptools build backend |

---

## 9 · Audit Re-verification (2026-07-07)

### Summary

All 3 test suites pass after one fix:

| Suite | Result | Details |
|-------|--------|---------|
| `npm run check` (tsc) | ✅ Pass | 0 errors |
| `npm test` (vitest) | ✅ Pass | 185/185 pass |
| `npm run ai:test` (pytest) | ✅ Pass | 50/50 pass (after fix) |

### ✅ DB-01 — Stale `spaceai.db` schema mismatch — **FIXED**

**Files:** `spaceAI/src/database.py:66`, `spaceAI/data/spaceai.db`

**Issue:** The `Correction` model has a `model_version_id` foreign key column (added for Expansion Phase 4) but the existing `spaceai.db` on disk was created before this column existed. SQLAlchemy's `create_all()` is idempotent and does not add missing columns to existing tables, causing `test_submit_correction` and `test_list_corrections` to fail with `OperationalError: no such column: corrections.model_version_id`.

**Fix:** Deleted the stale `spaceAI/data/spaceai.db` file. It is recreated with the correct schema on first `init_db()` call. The file is gitignored (`*.db` pattern) so this is a dev-only fix.

**Prevention:** Add Alembic or a manual migration step when schema changes. For now, the local DB can be safely deleted and recreated since there is no production data. *(2026-08-13: superseded — Postgres + Drizzle migrations `drizzle/0000–0004` are now the schema source of truth.)*

### 🔵 DB-02 — `model_version_id` in `corrections` table (Precursor)

**File:** `spaceAI/src/database.py:66`

The `model_version_id` foreign key on `corrections` references `model_versions.id`, but the Expansion Phase 4 (Model Versioning & Rollback) in `spaceai-ensemble-active-learning.md` is unchecked — none of its success criteria are met. The column exists but is always null. Consider either completing Phase 4 or removing the column until it's needed. No functional impact.
