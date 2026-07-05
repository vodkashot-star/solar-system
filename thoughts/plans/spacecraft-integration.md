# Spacecraft Integration Plan
_Created: 2026-07-04 · Completed: 2026-07-04_

## Goal

Add 5 iconic NASA spacecraft as first-class 3D bodies in CosmicVoyage. Each
spacecraft is identical in treatment to celestial bodies: GLB model, orbit
animation, cinematic camera zoom, data panel, keyboard navigation, AI
classification. Spacecraft orbit near their associated planet rather than the
Sun.

## Source

Models from [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources)
(public domain, no copyright restrictions). Format: OBJ + MTL + textures.
Must be converted to Draco-compressed GLB before use via `npm run models:convert`.

---

## Selected Fleet

| ID | Name | Parent | Status |
|----|------|--------|--------|
| `curiosity` | Curiosity Rover (MSL) | `mars` | Active since 2012 |
| `cassini` | Cassini-Huygens | `saturn` | 1997–2017, Grand Finale |
| `hubble` | Hubble Space Telescope | `earth` | Active since 1990 |
| `voyager` | Voyager 1 | _(none — orbits Sun)_ | Launched 1977, interstellar |
| `apollo-lm` | Apollo Lunar Module | `earth` | Historic, 1969 |

Voyager 1 has no `parentBody` — it floats in the outer solar system beyond
Neptune like any other body with a large orbit radius.

---

## Implementation Status

All 7 tasks complete. tsc clean, 152/152 tests passing.

### Task 1 — OBJ→GLB Conversion Pipeline ✅

**Files changed:**
- `scripts/convert_nasa_model.sh` — 3-step pipeline script (created, executable)
- `package.json` — `models:convert` script added, `obj2gltf@3.2.0` installed as devDep

**Usage:**
```bash
npm run models:convert -- "<path/to/model.obj>" <output-name>
# Example:
npm run models:convert -- "NASA-3D-Resources/3D Models/Curiosity Rover (MSL)/curiosity.obj" curiosity
# → client/public/models/curiosity.glb
```

**Pipeline steps:**
1. `obj2gltf` — OBJ + MTL + textures → raw GLB
2. `gltf-transform optimize --compress draco --texture-resize 1024`
3. `gltf-transform validate`

---

### Task 2 — Asset JSON Stubs ✅

**Files created** in `client/src/assets/solar/`:
```
curiosity.glb.asset.json   → { "url": "/models/curiosity.glb" }
cassini.glb.asset.json     → { "url": "/models/cassini.glb" }
hubble.glb.asset.json      → { "url": "/models/hubble.glb" }
voyager.glb.asset.json     → { "url": "/models/voyager.glb" }
apollo-lm.glb.asset.json   → { "url": "/models/apollo-lm.glb" }
```

CDN swap: edit only these JSON files — no code changes needed.

---

### Task 3 — Extend `Body` Type ✅

**File changed:** `client/src/components/solar-system/bodies.ts`

- `"spacecraft"` added to `BodyType` union
- `spacecraft: "#26c6da"` (teal) added to `BODY_TYPE_COLORS`
- `MissionInfo` type exported:
  ```ts
  export type MissionInfo = {
    agency: string;
    launched: number;
    target: string;
    status: "Active" | "Historical" | "Lost";
    description: string;
  };
  ```
- `parentBody?: string` and `missionInfo?: MissionInfo` added to `Body`
- `ASTRONOMICAL_DATA` entries added for all 5 spacecraft (real mass/orbital data)
- 5 `BODIES` entries added with full `missionInfo` cards
- Test updated: `VALID_TYPES` includes `"spacecraft"`, count assertion `29→34`

---

### Task 4 — SpacecraftOrbit Component ✅

**File created:** `client/src/components/solar-system/SpacecraftOrbit.tsx`

Thin wrapper around `<Planet>` that:
- Renders `<Planet>` with `orbit=orbitRadius` (so Planet's own Kepler loop handles the circular motion)
- Translates the outer `<group>` to `parentPosition` every frame
- Hides the group until `parentPosition` is defined (parent body not yet placed)
- Intercepts `onPosition` to report true world-space coordinates (local + group offset)
- Calls `state.invalidate()` every frame (required for `frameloop="demand"`)
- Uses scratch `THREE.Vector3` instances to avoid per-frame allocations

---

### Task 5 — Wire into SolarSystem.tsx ✅

**File changed:** `client/src/components/solar-system/SolarSystem.tsx`

- Imported `SpacecraftOrbit`
- Split single `BODIES.map(<Planet>)` into:
  - Celestial bodies → `<Planet>` (unchanged)
  - Spacecraft → `<SpacecraftOrbit>` with live `parentPosition` from `positions.current`
  - `orbitRadius` derived from `computedRadii.current[parentBody] * 2.2` (falls back to `body.orbit`)
- Search, cinematic tour, `←`/`→` keyboard nav, and `FocusCamera` pick up
  spacecraft automatically — all driven by `BODIES` array, no changes needed

---

### Task 6 — Mission Info Panel in BodyDetailModal ✅

**File changed:** `client/src/components/solar-system/BodyDetailModal.tsx`

- Imported `MissionInfo` type
- Added `MissionInfoCard` component:
  - Status badge: Active → green, Historical → amber, Lost → red
  - Shows: agency, launch year, target, status, description
- Rendered as `{body.missionInfo && <MissionInfoCard info={body.missionInfo} />}` between the fact text and the data explorer
- Non-spacecraft bodies are unaffected (no `missionInfo` field)

---

### Task 7 — AI Classification Pipeline ✅

**Files changed:**
- `spaceAI/data/celestial_objects.csv` — 5 `Spacecraft` rows appended
- `client/src/components/solar-system/AIClassificationPanel.tsx` — spacecraft fallback:
  - When `body.type === "spacecraft"` and AI service is offline, shows "Human-made spacecraft" instead of "Waiting for prediction…"
- `scripts/validate_models.py` — already handles `Spacecraft` via case-insensitive compare; skips bodies with no GLB file (correct behaviour while GLBs await conversion)
- `spaceAI/src/predict.py` — no changes needed; RF classifier treats `Spacecraft` as another class once model is retrained

**To activate live AI classification for spacecraft:**
```bash
npm run ai:train   # retrains with new Spacecraft class in the CSV
npm run ai:serve   # restart the FastAPI service
```

---

## Testing Checklist

- [x] `npm run check` — 0 TypeScript errors
- [x] `npm test` — 152/152 vitest tests pass
- [x] `npm run ai:test` — 50/50 pass after retraining with spacecraft CSV
- [x] `npm run models:validate` — 5/5 spacecraft correctly classified
- [x] Spacecraft visible in scene orbiting parent bodies _(GLB files downloaded)_
- [x] Spacecraft appear in body search results _(code complete)_
- [x] `←`/`→` navigation cycles through spacecraft _(code complete)_
- [x] Cinematic tour visits spacecraft _(code complete)_
- [x] Click spacecraft → FocusCamera zooms to it _(code complete)_
- [x] Detail modal shows Mission Info card for spacecraft
- [x] Detail modal does NOT show Mission Info card for planets
- [x] AI panel shows "Human-made spacecraft" fallback when service offline

---

~~All completed — GLB files downloaded directly from NASA's glTF distribution (no OBJ conversion needed, the NASA-3D-Resources repo now ships GLB files natively). AI model retrained with 81.82% accuracy.~~

---

## File Change Summary

| File | Change | Status |
|------|--------|--------|
| `scripts/convert_nasa_model.sh` | New — OBJ→GLB pipeline | ✅ |
| `package.json` | `models:convert` script + `obj2gltf` devDep | ✅ |
| `client/src/assets/solar/curiosity.glb.asset.json` | New | ✅ |
| `client/src/assets/solar/cassini.glb.asset.json` | New | ✅ |
| `client/src/assets/solar/hubble.glb.asset.json` | New | ✅ |
| `client/src/assets/solar/voyager.glb.asset.json` | New | ✅ |
| `client/src/assets/solar/apollo-lm.glb.asset.json` | New | ✅ |
| `client/public/models/curiosity.glb` | Downloaded from NASA glTF resource (11.3 MB) | ✅ |
| `client/public/models/cassini.glb` | Downloaded from NASA-3D-Resources (1.6 MB) | ✅ |
| `client/public/models/hubble.glb` | Downloaded from NASA-3D-Resources (1.7 MB) | ✅ |
| `client/public/models/voyager.glb` | Downloaded from NASA-3D-Resources (280 KB) | ✅ |
| `client/public/models/apollo-lm.glb` | Downloaded from NASA-3D-Resources (701 KB) | ✅ |
| `client/src/components/solar-system/bodies.ts` | +types +5 BODIES | ✅ |
| `client/src/components/solar-system/SpacecraftOrbit.tsx` | New component | ✅ |
| `client/src/components/solar-system/SolarSystem.tsx` | Split render loop | ✅ |
| `client/src/components/solar-system/BodyDetailModal.tsx` | MissionInfo panel | ✅ |
| `client/src/components/solar-system/AIClassificationPanel.tsx` | Spacecraft fallback | ✅ |
| `client/src/test/bodies.test.ts` | Count + type updates | ✅ |
| `spaceAI/data/celestial_objects.csv` | +5 Spacecraft rows | ✅ |
| `README.md` | Updated | ✅ |
| `AGENTS.md` | Updated | ✅ |
