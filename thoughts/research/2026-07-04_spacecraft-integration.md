---
date: 2026-07-04T11:00:00+00:00
topic: "Spacecraft integration — NASA 3D Resources OBJ→GLB pipeline + first-class spacecraft bodies"
tags: [implementation, spacecraft, nasa, glb, pipeline, bodies, ai]
---

## Summary

Added 5 NASA spacecraft as first-class bodies in CosmicVoyage. All code
changes are complete and passing (tsc clean, 152 tests). The GLB files
themselves require a one-time manual conversion step using `npm run models:convert`.

## What Was Built

### Conversion Pipeline

`scripts/convert_nasa_model.sh` — 3-step pipeline:
1. `obj2gltf` (OBJ + MTL + textures → raw GLB)
2. `gltf-transform optimize --compress draco --texture-resize 1024`
3. `gltf-transform validate`

`obj2gltf@3.2.0` installed as devDependency. `@gltf-transform/cli` was already present.

Usage: `npm run models:convert -- "<path/to/model.obj>" <output-name>`

### Body Type System

`BodyType` union extended with `"spacecraft"`. New `MissionInfo` type:
```ts
type MissionInfo = {
  agency: string;
  launched: number;
  target: string;
  status: "Active" | "Historical" | "Lost";
  description: string;
};
```
`Body` gains optional `parentBody?: string` and `missionInfo?: MissionInfo`.

### Fleet

| ID | Name | Parent | Mission status |
|----|------|--------|----------------|
| curiosity | Curiosity Rover | mars | Active |
| cassini | Cassini-Huygens | saturn | Historical |
| hubble | Hubble Space Telescope | earth | Active |
| voyager | Voyager 1 | (none) | Active |
| apollo-lm | Apollo Lunar Module | earth | Historical |

### SpacecraftOrbit Component

`SpacecraftOrbit.tsx` wraps `<Planet>` with parent-relative positioning:
- Renders `<Planet body={localBody}>` where `localBody.orbit = orbitRadius`
- Outer `<group>` translated to `parentPosition` every frame
- Hidden until `parentPosition` is defined (parent not yet rendered)
- Intercepts `onPosition` to return world-space coords (local + group offset)
- Scratch vectors reused each frame — no allocations

Rationale for wrapper approach vs modifying Planet: Planet's Kepler loop handles
circular orbital motion correctly. SpacecraftOrbit just shifts the origin from
Sun to the parent body. No code duplication.

### SolarSystem Render Split

Single `BODIES.map(<Planet>)` split into two:
```tsx
{BODIES.filter(b => b.type !== "spacecraft").map(b => <Planet .../>)}
{BODIES.filter(b => b.type === "spacecraft").map(b => <SpacecraftOrbit .../>)}
```
Search, tour, keyboard nav, FocusCamera all use `BODIES` array — spacecraft
appear in all of those automatically without further changes.

### MissionInfo Panel

`BodyDetailModal` renders `<MissionInfoCard>` when `body.missionInfo` is set.
Card shows: agency, launch year, target, status badge (green/amber/red), description.
Rendered between the fact text and the data explorer section.

### AI Classification

5 `Spacecraft` rows added to `celestial_objects.csv`. RF classifier will learn
the class on next `npm run ai:train`. Offline fallback: "Human-made spacecraft"
shown in `AIClassificationPanel` for spacecraft with no `aiAnalysis`.

## Key Design Decisions

**Why keep orbit=small_value in BODIES for spacecraft rather than orbit=0?**
Voyager has no `parentBody`, so it needs a sun-relative orbit like any other
body. Spacecraft with a `parentBody` use `orbit` as a fallback when
`parentPosition` is not yet available. A non-zero orbit prevents them from
snapping to the Sun origin on first render.

**Why `computedRadii.current[parentBody] * 2.2` for orbitRadius?**
The spacecraft should visibly circle just outside the parent's rendered mesh.
`computedRadii` stores the actual rendered size of each body (computed from the
loaded GLB bounding box). Multiplying by 2.2 puts the spacecraft just beyond
the parent's surface. Falls back to `body.orbit` if parent radius is unknown.

**Why orbitRadius from SolarSystem rather than hardcoded in SpacecraftOrbit?**
The rendered radius of a planet changes with `scaleMultiplier`. Computing it
at the SolarSystem level (where `computedRadii` and `scaleMultiplier` both
live) avoids threading more props through the component tree.

## Files Changed

```
scripts/convert_nasa_model.sh              (new)
package.json                               (models:convert + obj2gltf)
client/src/assets/solar/curiosity.glb.asset.json   (new)
client/src/assets/solar/cassini.glb.asset.json     (new)
client/src/assets/solar/hubble.glb.asset.json      (new)
client/src/assets/solar/voyager.glb.asset.json     (new)
client/src/assets/solar/apollo-lm.glb.asset.json   (new)
client/src/components/solar-system/bodies.ts       (types + 5 entries)
client/src/components/solar-system/SpacecraftOrbit.tsx  (new)
client/src/components/solar-system/SolarSystem.tsx (split render loop)
client/src/components/solar-system/BodyDetailModal.tsx  (MissionInfo panel)
client/src/components/solar-system/AIClassificationPanel.tsx (fallback)
client/src/test/bodies.test.ts             (count 29→34, VALID_TYPES)
spaceAI/data/celestial_objects.csv         (+5 Spacecraft rows)
README.md                                  (updated)
AGENTS.md                                  (updated)
thoughts/AUDIT.md                          (updated)
thoughts/plans/spacecraft-integration.md   (updated to reflect completion)
```

## Pending (requires manual action)

1. Convert 5 NASA OBJ models with `npm run models:convert` (requires NASA-3D-Resources repo)
2. Retrain AI: `npm run ai:train`
3. Validate: `npm run models:validate`

## Test Results

```
tsc       — 0 errors
vitest    — 152/152 passed (was 131, added 21 parameterised spacecraft tests)
pytest    — not re-run (no Python files changed)
```
