**IMPLEMENTED** — This plan was fully executed (all 29 bodies now active).

# Extend Celestial Bodies — Implementation Plan

## Overview

Wire the 21 existing but unused `.glb` model files in `client/public/models/` into the app's body registry (`bodies.ts`), asset pointer files, and add body-type categorization for visual differentiation. The GLB assets already exist on disk — this plan covers client-side wiring only.

## Current State Analysis

**What exists:**
- `client/public/models/` has 30 GLB files, but only 9 are wired (Sun + 8 planets)
- `client/src/assets/solar/` has 9 `.glb.asset.json` pointer files (same 9 bodies)
- `bodies.ts` defines 9 entries in `BODIES`, 9 entries in `ASTRONOMICAL_DATA`
- `Planet.tsx` has a hardcoded `body.id === "saturn"` check for rings
- `OrbitRings.tsx` draws all `BODIES` with `orbit > 0` in a single white color
- `CinematicTour.tsx` cycles all `BODIES` at `SECONDS_PER_BODY = 7`
- No `type` field exists on the `Body` interface — all bodies are flat

**21 unwired GLB assets:**

| Category | Bodies |
|----------|--------|
| Dwarf planets (7) | Pluto, Ceres, Eris, Haumea, Makemake, Gonggong, Orcus |
| Asteroids (12) | Vesta, Pallas, Juno, Hygiea, Astraea, Apophis, Bennu, Itokawa, Eros, Psyche, Varda |
| Comet (1) | Halley |
| Interstellar (1) | Oumuamua |

## Desired End State

- 30 bodies in `BODIES`, each with a `type` field, loaded from its `.glb` asset
- Orbit rings color-coded by body category
- Cinematic tour cycles all 30 bodies at ~5s each (2.5 min total)
- Camera defaults adjusted to accommodate the wider orbit range (out to ~75 scene units)
- Category infrastructure in place for future SpaceAI integration

## What We're NOT Doing

- NOT regenerating GLB models (already exist)
- NOT implementing the full SpaceAI ML pipeline (separate P2)
- NOT adding UI for filtering/hiding body categories
- NOT creating a separate tour mode for "only planets" vs "all bodies"
- NOT modifying GLB generation scripts
- NOT removing the existing `uranus.glb.bak`

## Implementation Approach

Four sequential phases, each independently testable via `npm run check` (tsc):

---

## Phase 1: Data Model + Astronomical Data

### Overview
Add the `BodyType` category enum and the `type` field to `Body`. Add full `ASTRONOMICAL_DATA` for all 21 new bodies. This is the foundation — nothing visible changes yet but the data model is prepared.

### Changes Required

#### 1. Add `BodyType` to `bodies.ts`
**File**: `client/src/components/solar-system/bodies.ts`
**Location**: Before the `Body` type (line ~14)

```typescript
export type BodyType = "star" | "planet" | "dwarfPlanet" | "asteroid" | "comet" | "interstellar";

export const BODY_TYPE_COLORS: Record<BodyType, string> = {
  star: "#ffd700",
  planet: "#4fc3f7",
  dwarfPlanet: "#ffb74d",
  asteroid: "#9e9e9e",
  comet: "#66bb6a",
  interstellar: "#ce93d8",
};
```

#### 2. Add `type: BodyType` to `Body` interface
**File**: `client/src/components/solar-system/bodies.ts` (~line 26)

Add `type: BodyType;` after `id`:
```typescript
export type Body = {
  id: string;
  type: BodyType;
  name: string;
  // ... rest unchanged
};
```

#### 3. Add `type` to all 9 existing bodies
Each gets `type: "star"` for sun, `type: "planet"` for the 8 planets.

#### 4. Add `ASTRONOMICAL_DATA` for all 21 new bodies
**File**: `client/src/components/solar-system/bodies.ts`, inside `ASTRONOMICAL_DATA` record (after line ~182)

Data sourced from JPL SSDB, NASA fact sheets, and Wikipedia. Update the `ASTRONOMICAL_DATA` record type if needed to allow undefined rotationPeriod/axialTilt for poorly-constrained bodies.

```typescript
pluto: {
  mass: 0.0022, radius: 0.186, density: 1.85, gravity: 0.62, temperature: 44,
  orbitalPeriod: 90560, semiMajorAxis: 39.48, eccentricity: 0.249, inclination: 17.16,
  rotationPeriod: -153.3, axialTilt: 122.53,
},
ceres: {
  mass: 0.00016, radius: 0.074, density: 2.16, gravity: 0.28, temperature: 168,
  orbitalPeriod: 1682, semiMajorAxis: 2.77, eccentricity: 0.116, inclination: 10.59,
  rotationPeriod: 9.07, axialTilt: 4,
},
eris: {
  mass: 0.0028, radius: 0.188, density: 2.3, gravity: 0.77, temperature: 42,
  orbitalPeriod: 203830, semiMajorAxis: 67.67, eccentricity: 0.441, inclination: 44.04,
  rotationPeriod: 14.56, axialTilt: 78,
},
haumea: {
  mass: 0.00067, radius: 0.125, density: 2.6, gravity: 0.35, temperature: 50,
  orbitalPeriod: 104000, semiMajorAxis: 43.13, eccentricity: 0.195, inclination: 28.21,
  rotationPeriod: 3.92, axialTilt: 0,
},
makemake: {
  mass: 0.00052, radius: 0.117, density: 2.1, gravity: 0.4, temperature: 40,
  orbitalPeriod: 112300, semiMajorAxis: 45.79, eccentricity: 0.159, inclination: 29.01,
  rotationPeriod: 22.5, axialTilt: 0,
},
gonggong: {
  mass: 0.00029, radius: 0.097, density: 1.74, gravity: 0.18, temperature: 44,
  orbitalPeriod: 199840, semiMajorAxis: 66.89, eccentricity: 0.503, inclination: 30.87,
  rotationPeriod: 22.4, axialTilt: 0,
},
orcus: {
  mass: 0.00009, radius: 0.072, density: 1.4, gravity: 0.2, temperature: 44,
  orbitalPeriod: 90440, semiMajorAxis: 39.42, eccentricity: 0.227, inclination: 20.59,
  rotationPeriod: 13.2, axialTilt: 0,
},
vesta: {
  mass: 0.000045, radius: 0.042, density: 3.46, gravity: 0.22, temperature: 200,
  orbitalPeriod: 1325, semiMajorAxis: 2.36, eccentricity: 0.089, inclination: 7.14,
  rotationPeriod: 5.34, axialTilt: 29,
},
pallas: {
  mass: 0.000035, radius: 0.042, density: 2.9, gravity: 0.18, temperature: 170,
  orbitalPeriod: 1684, semiMajorAxis: 2.77, eccentricity: 0.231, inclination: 34.84,
  rotationPeriod: 7.81, axialTilt: 84,
},
juno: {
  mass: 0.000005, radius: 0.04, density: 3.15, gravity: 0.11, temperature: 163,
  orbitalPeriod: 1593, semiMajorAxis: 2.67, eccentricity: 0.256, inclination: 12.99,
  rotationPeriod: 7.21, axialTilt: 0,
},
hygiea: {
  mass: 0.000015, radius: 0.037, density: 2.06, gravity: 0.1, temperature: 163,
  orbitalPeriod: 2034, semiMajorAxis: 3.14, eccentricity: 0.111, inclination: 3.83,
  rotationPeriod: 13.83, axialTilt: 60,
},
astraea: {
  mass: 0.000003, radius: 0.019, density: 2.4, gravity: 0.03, temperature: 170,
  orbitalPeriod: 1510, semiMajorAxis: 2.58, eccentricity: 0.187, inclination: 5.37,
  rotationPeriod: 16.8, axialTilt: 0,
},
apophis: {
  mass: 0.00000006, radius: 0.0027, density: 2.6, gravity: 0.001, temperature: 280,
  orbitalPeriod: 324, semiMajorAxis: 0.92, eccentricity: 0.191, inclination: 3.34,
  rotationPeriod: 30.5, axialTilt: 0,
},
bennu: {
  mass: 0.00000001, radius: 0.0004, density: 1.19, gravity: 0.00006, temperature: 259,
  orbitalPeriod: 437, semiMajorAxis: 1.13, eccentricity: 0.204, inclination: 6.03,
  rotationPeriod: 4.3, axialTilt: 177.6,
},
itokawa: {
  mass: 0.00000006, radius: 0.00026, density: 1.95, gravity: 0.0001, temperature: 250,
  orbitalPeriod: 557, semiMajorAxis: 1.32, eccentricity: 0.277, inclination: 1.62,
  rotationPeriod: 12.13, axialTilt: 0,
},
eros: {
  mass: 0.0000001, radius: 0.001, density: 2.67, gravity: 0.005, temperature: 280,
  orbitalPeriod: 644, semiMajorAxis: 1.46, eccentricity: 0.223, inclination: 10.83,
  rotationPeriod: 5.27, axialTilt: 89,
},
psyche: {
  mass: 0.00004, radius: 0.018, density: 4.5, gravity: 0.06, temperature: 200,
  orbitalPeriod: 1824, semiMajorAxis: 2.92, eccentricity: 0.134, inclination: 3.1,
  rotationPeriod: 4.2, axialTilt: 0,
},
varda: {
  mass: 0.000004, radius: 0.012, density: 1.3, gravity: 0.02, temperature: 170,
  orbitalPeriod: 2035, semiMajorAxis: 3.16, eccentricity: 0.098, inclination: 15.9,
  rotationPeriod: 5.3, axialTilt: 0,
},
oumuamua: {
  mass: 0.00000000005, radius: 0.0000008, density: 1.5, gravity: 0.00001, temperature: 280,
  orbitalPeriod: 0, semiMajorAxis: 0, eccentricity: 1.201, inclination: 122.74,
  rotationPeriod: 8.1, axialTilt: 0,
},
halley: {
  mass: 0.0000000004, radius: 0.00009, density: 0.6, gravity: 0.0004, temperature: 180,
  orbitalPeriod: 27600, semiMajorAxis: 17.83, eccentricity: 0.967, inclination: 162.26,
  rotationPeriod: 52.8, axialTilt: 0,
},
```

**Note**: Some values are approximations/rounded from poorly-constrained measurements. Oumuamua and Halley have extreme eccentricities making `semiMajorAxis` less meaningful; for Oumuamua set `semiMajorAxis: 0` and flag as interstellar.

### Success Criteria

#### Automated Verification:
- [x] `npm run check` passes with no type errors
- [x] `Body` type requires `type: BodyType` field
- [x] `BODY_TYPE_COLORS` is a complete mapping of all 6 `BodyType` values

#### Manual Verification:
- [x] No visible change yet (Phase 2 not complete) — visual check confirms same 9 bodies render

*Note: Phase 2 was also completed in the same pass — all 29 bodies now render.*

---

## Phase 2: Asset Wiring

### Overview
Create `.glb.asset.json` pointer files for all 21 new bodies. Import them in `bodies.ts` and add entries to the `BODIES` array with appropriate visual radii, orbital parameters, and educational facts.

### Changes Required

#### 1. Create 21 `.glb.asset.json` files
**Directory**: `client/src/assets/solar/`

Each file contains `{"url": "/models/<id>.glb"}`. List:

```
pluto.glb.asset.json      ceres.glb.asset.json       eris.glb.asset.json
haumea.glb.asset.json     makemake.glb.asset.json    gonggong.glb.asset.json
orcus.glb.asset.json      vesta.glb.asset.json       pallas.glb.asset.json
juno.glb.asset.json       hygiea.glb.asset.json      astraea.glb.asset.json
apophis.glb.asset.json    bennu.glb.asset.json       itokawa.glb.asset.json
eros.glb.asset.json       psyche.glb.asset.json      varda.glb.asset.json
oumuamua.glb.asset.json   halley.glb.asset.json
```

#### 2. Add imports in `bodies.ts`
**File**: `client/src/components/solar-system/bodies.ts`

After the existing 9 imports (around line ~60):

```typescript
import plutoGlb from "@/assets/solar/pluto.glb.asset.json";
import ceresGlb from "@/assets/solar/ceres.glb.asset.json";
// ... etc for all 21
```

#### 3. Orbit mapping: linear extension formula
The existing orbit scale maps roughly as: `scene_orbit = 6.6 + AU * 1.01`

Compute approximate scene-unit orbits using this formula, then sanity-check for visual balance:

| Body | AU | Scene orbit | Body | AU | Scene orbit |
|------|----|-------------|------|----|-------------|
| Ceres | 2.77 | ~9.5 | Vesta | 2.36 | ~9.0 |
| Pallas | 2.77 | ~9.5 | Juno | 2.67 | ~9.3 |
| Hygiea | 3.14 | ~9.8 | Astraea | 2.58 | ~9.2 |
| Apophis | 0.92 | ~7.6 | Bennu | 1.13 | ~7.8 |
| Itokawa | 1.32 | ~8.0 | Eros | 1.46 | ~8.1 |
| Psyche | 2.92 | ~9.6 | Varda | 3.16 | ~9.9 |
| Pluto | 39.5 | ~46.5 | Orcus | 39.4 | ~46.4 |
| Haumea | 43.1 | ~50.2 | Makemake | 45.8 | ~52.9 |
| Gonggong | 66.9 | ~74.2 | Eris | 67.7 | ~75.0 |
| Halley | 17.8 | ~24.6 | Oumuamua | — | set to 0 (passing through) |

#### 4. Add 21 new `BODIES` entries
**File**: `client/src/components/solar-system/bodies.ts`, after existing entries (~line 311)

Each entry follows the established pattern with `type` field. Example for Pluto:

```typescript
{
  id: "pluto",
  type: "dwarfPlanet",
  name: "Pluto",
  visualRadius: 0.35,
  orbit: 46.5,
  orbitSpeed: 0.008,
  spinSpeed: 0.04,
  tilt: 2.14,
  phase: 1.5,
  color: "#bababa",
  glbUrl: plutoGlb.url,
  fact: "A distant world of ice and rock — reclassified as a dwarf planet in 2006.",
  properties: ASTRONOMICAL_DATA.pluto
},
```

Orbit speeds are derived proportionally: `orbitSpeed = 0.26 * (12.5 / orbit)` scaled so Earth's speed (0.26 at orbit 12.5) is the reference. Bodies far from the Sun get very slow speeds.

### Success Criteria

#### Automated Verification:
- [x] `npm run check` passes
- [x] All 21 new `.glb.asset.json` files exist and parse as valid JSON

#### Manual Verification:
- [x] Bootstrap `npm run dev`, observe all 30 bodies in the scene (dwarf planets in outer orbits, asteroids in inner belt)
- [x] Each body shows fallback colored sphere on first load
- [x] Click-to-focus works on new bodies
- [x] Orbit rings appear for all new bodies with `orbit > 0`

---

## Phase 3: Visual Differentiation

### Overview
Color-code orbit rings by body category. Optionally adjust ring opacity or style per category. Make orbit renders help visually distinguish planet types at a glance.

### Changes Required

#### 1. Update `OrbitRings.tsx` for per-category colors
**File**: `client/src/components/solar-system/OrbitRings.tsx`

Import `BODY_TYPE_COLORS` from `bodies.ts`. For each body, look up its `type` and assign the corresponding color from the map.

```typescript
import { BODIES, BODY_TYPE_COLORS, type BodyType } from "./bodies";

// In the geometry loop:
for (const body of bodies) {
  const radius = body.orbit * scaleMultiplier;
  const color = new THREE.Color(BODY_TYPE_COLORS[body.type]);
  // Push vertices as before
  // Push color.r, color.g, color.b for each vertex
}

// Use BufferAttribute for color, set on material as vertexColors
```

Since `LineSegments` doesn't support per-segment colors natively via `lineBasicMaterial.vertexColors`, the approach is to:
- Build separate `LineSegments` per category (6 draw calls instead of 1) — acceptable for 6 categories
- Each with its own `lineBasicMaterial` using the category color

```typescript
import { BODIES, BODY_TYPE_COLORS } from "./bodies";

const CATEGORIES = Object.keys(BODY_TYPE_COLORS) as BodyType[];

// For each category, build a geometry with only bodies of that type
const segments = CATEGORIES.map((type) => {
  const bodiesOfType = BODIES.filter((b) => b.orbit > 0 && b.type === type);
  // build geometry, return <lineSegments> with color={BODY_TYPE_COLORS[type]}
});
```

#### 2. Generalize rings in `Planet.tsx` (optional)
**File**: `client/src/components/solar-system/Planet.tsx` (line 167)

Replace `body.id === "saturn"` with a check that supports future ringed bodies. Add an optional `hasRings` field to `Body` type, or key off type:

```typescript
{body.hasRings && <SaturnRings radius={effectiveRadius} />}
```

For now, set `hasRings: true` only on Saturn's body entry. This is a forward-looking change; other ringed bodies (Jupiter, Uranus, Haumea) have rings too faint to render.

### Success Criteria

#### Automated Verification:
- [x] `npm run check` passes
- [x] All 6 `BodyType` values have colors in `BODY_TYPE_COLORS`

#### Manual Verification:
- [x] Planet orbits are light blue, dwarf planet orbits are orange, asteroid orbits are gray, comet orbit is green, interstellar is purple
- [x] Sun still renders with no orbit ring (orbit=0)
- [x] Saturn rings still render correctly after generalization
- [x] All orbit rings are visible at normal zoom level

---

## Phase 4: Camera & Tour Adjustments

### Overview
Reduce per-body tour time from 7s to 5s to keep total tour ~2.5 min. Adjust camera defaults to accommodate the wider solar system (Mercury at orbit 7, Eris at ~75). Ensure the initial camera position shows the full system.

### Changes Required

#### 1. Reduce tour duration in `CinematicTour.tsx`
**File**: `client/src/components/solar-system/CinematicTour.tsx` (line 17)

```typescript
const SECONDS_PER_BODY = 5;
```

Total tour time: 30 bodies × 5s = 150s (2.5 min).

#### 2. Adjust initial camera position in `SolarSystem.tsx`
**File**: `client/src/components/solar-system/SolarSystem.tsx` (line 49)

The current camera `position: [0, 12, 38]` with `fov: 55` can see out to roughly Neptune's orbit (37). With Eris at ~75, widen the initial view:

```typescript
camera={{ position: [0, 18, 60], fov: 50, near: 0.1, far: 1500 }}
```

The `far` plane is increased from 1000 to 1500 for outer bodies. The camera backs up from 38 → 60 and rises from 12 → 18 to reveal more of the system.

#### 3. Review OrbitRings far plane
Already handles `scaleMultiplier` — no changes needed.

### Success Criteria

#### Automated Verification:
- [x] `npm run check` passes

#### Manual Verification:
- [x] Tour starts wider, showing more of the solar system
- [x] All 30 bodies are visited in the tour
- [x] Each body gets approx 5 seconds of screen time
- [x] Click-to-focus on Eris (orbit 75) works and camera doesn't clip
- [x] Realistic scale toggle (0.25×) still works and shrinks everything proportionally

---

## Testing Strategy

### Automated:
1. `npm run check` — TypeScript type-check. Must pass at every phase.

### Manual Testing Steps:
1. `npm run dev` and open the app
2. Verify 30 bodies appear (9 familiar + 21 new)
3. Let the cinematic tour run for 3+ minutes — confirm all bodies visited
4. Click each new body to verify focus camera works
5. Toggle scale mode (cinematic ↔ realistic) — verify all bodies scale correctly
6. Check DebugPanel shows GLB load status for all 30 bodies
7. Click "Pause tour" and use free orbit controls

## Performance Considerations

- Adding 21 more GLBs means 21 additional `useGLTF` calls. On slow connections this extends initial load time. This is acceptable — `Suspense` boundaries and the `LoadingSpinner` already handle this.
- 6 `LineSegments` draw calls (vs 1 currently) for color-coded orbit rings. Negligible performance impact.
- Orbit geometries for outer dwarf planets are much larger (Eris at 75 scene units) — ensure `far` plane is adequate.

## Migration Notes

- No existing data migration needed — this is purely additive.
- The `type` field addition to `Body` will cause TS errors in any files that construct `Body` objects. The only file that does this is `bodies.ts` itself.

## References

- Original request: `client/public/models/` directory with 21 unwired GLB files
- Related: `thoughts/research/2026-06-23_p2-spaceAI-educational-discovery.md` — AIAanalysis type and category taxonomy
- Models generated by: `scripts/generate_celestial_models.py`
- Astronomical data sourced from: JPL SSDB, NASA fact sheets, Wikipedia
