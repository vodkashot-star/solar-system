---
name: celestial-design
description: Use when designing, adding, or visually tuning celestial bodies — body catalog entries in bodies.ts, procedural texture definitions, planet visual qualities (bands/voronoi/emissive), rings, or choosing between GLB model vs procedural FallbackSphere. Also covers the GLB-vs-procedural material pipeline for planet appearance.
---

# Celestial Design

How a body's look is designed: catalog data → procedural textures / GLB model →
material quality. Three sources combine: `bodies.ts` (catalog + orbit data),
`procedural-textures.ts` (procedural look), `Planet.tsx`/`RingSystem.tsx`
(rendering), and GLB assets (see `glb-models` + `glb-asset-json` skills).

## 1. Body catalog (`client/src/components/solar-system/bodies.ts`)

`BodyType`: `star | planet | dwarfPlanet | asteroid | comet | interstellar | spacecraft`.
`BODY_TYPE_COLORS` maps each type to a UI accent color (star #ffd700, planet
#4fc3f7, dwarfPlanet #ffb74d, asteroid #9e9e9e, comet #66bb6a, interstellar
#ce93d8, spacecraft #26c6da) — used by HUD/UI, not the 3D material.

Per-body design fields:

| Field | Purpose |
|-------|---------|
| `visualRadius` | Scene radius (logarithmic scale, NOT real sizes) |
| `color` | Fallback color if no GLB; also used when procedural textures are absent |
| `tilt` | Axial tilt (radians) — set `tilt` + `spinSpeed` for realistic rotation |
| `hasRings` | Renders `RingSystem` — Saturn/Jupiter/Uranus/Neptune/Haumea |
| `glbUrl` | Optional — if absent the body renders a `FallbackSphere` |
| `parentBody` | Spacecraft/moons orbit this body instead of the Sun |
| `missionInfo` | Spacecraft metadata for the detail modal |
| `properties` | Real astronomical data (below) — separate from scene visuals |

`AstronomicalProperties` (all real units, rendered in the detail modal):
mass (Earth masses), radius (Earth radii), density (g/cm³), gravity (m/s²),
temperature (K), orbitalPeriod (days), semiMajorAxis (AU), eccentricity,
inclination (deg), rotationPeriod (hours), axialTilt (deg).
`properties` is informational — **do not** derive scene radius/orbit from it;
scene scale is intentionally compressed.

## 2. GLB vs FallbackSphere decision

- Real NASA GLBs exist for: planets, major moons, spacecraft (juno, cassini,
  curiosity, hubble, voyager…), asteroids bennu/itokawa/eros. They load via
  `.glb.asset.json` pointers (see `glb-asset-json` skill).
- **No GLB** (procedural `FallbackSphere`): dragonfly, minor asteroids (vesta,
  pallas, juno, hygiea, astraea, apophis, psyche, varda, oumuamua, halley).
- Dwarf planets (pluto, eris, makemake, haumea, gonggong, orcus) have LOW-POLY
  GLBs built from `/tmp/sphere.py` (see `glb-models` skill) — only pluto has a
  real NASA equirect map (PIA19858); the rest are 0.8/0.8/0.82 albedo + the
  procedural maps below applied on top.
- New body rule: prefer a real NASA GLB (self-contained, Draco). Only use
  procedural when no NASA model exists. Never hardcode `/models/` URLs —
  always the `.glb.asset.json` pointer.

## 3. Procedural textures (`client/src/lib/procedural-textures.ts`)

Used for bodies WITHOUT real GLBs AND layered onto low-poly dwarf GLBs
(`applyProceduralMaterials` in `Planet.tsx` line ~105 runs on GLB scenes too).

`TEXTURE_DEFS` is keyed by bodyId (fallback `getDef` by type: sun/earth defs,
DWARF_DEF, ASTEROID_DEF, COMET_DEF). Per-body look is tuned with:

| Def field | Effect |
|-----------|--------|
| `baseColor` | 2-3 RGB gradient stops interpolated by noise value |
| `noiseLayers` | `{scale, amplitude, octaves}` fbm layers sampled in 3D (sphere-projected, seamless) |
| `banded` + `bandCount` + `bandVariation` | Gas-giant bands (jupiter 24, saturn 20, uranus 16, neptune 18, venus 14, earth 8) |
| `useVoronoi` + `voronoiCells` | Cratered look (mercury 80, mars 60, asteroids 100, comets 40) |
| `emissive` + `emissiveColor` | Sun only (glow), intensity 1.5 |

Blend rule in `generateDiffuseMap`: `bandVal*0.6 + voronoiVal*0.4` when banded,
else noise-only; colors interpolated across the stops. `TEX_SIZE` = 1024x512
canvas; texture wraps S (seamless equator), clamps T.

Derived maps: `generateNormalMap` (sobel-ish from diffuse, strength 2),
`generateRoughnessMap` (luminance*200), `generateEmissiveMap` (sun random
granulation). All cached in `textureCache` keyed `diff|norm|rough|emis:<bodyId>`
— generation is CPU-heavy (1024² per map), so **always use the `getCached*`
accessors**, never the raw generators.

Material quality in `FallbackSphere` (`Planet.tsx` line ~160): roughness 0.7,
metalness 0.1, normalScale (1.5, 1.5), diffuse+normal+roughness maps, cache
key `fallback:bodyId:bodyType:color` (per-body textures stay unique, materials
don't leak).

## 4. Rings (`RingSystem.tsx`)

`RING_PARAMETERS` keyed by bodyId: innerRadius/outerRadius in planet radii,
inclination (deg), opticalDepth (0-1 → opacity min(×1.2, 0.8)), color,
segments. Real values: saturn 1.24–2.27R @26.7° (0.8 depth), uranus 1.59–2.0R
@97.8° (near-vertical), jupiter/neptune faint (0.01-0.05), haumea 1.4–1.8R.
Rendered as `MeshBasicMaterial` RingGeometry, double-sided, depthWrite off.
Tuning: to make rings more visible raise `opticalDepth`; to widen change the
radius pair (must stay > 1.0 or they clip the planet).

## 5. Design workflow for a NEW body

1. Add entry to `bodies.ts` (id, type, visualRadius, orbit, orbitSpeed, spinSpeed, tilt, phase, color, fact, properties).
2. Add `TEXTURE_DEFS[bodyId]` if you want a distinct procedural look; otherwise type-default is used.
3. If a NASA model exists: convert → Draco → `npm run models:validate` (see `glb-models`), add `.glb.asset.json` pointer, set `glbUrl`.
4. If rings: add `RING_PARAMETERS[bodyId]` and `hasRings: true`.
5. Verify: `npm run check`, `npm test` (bodies.test.ts asserts catalog invariants), `npm run models:validate` if GLB added.

## Quality checklist

- Bodies never look "flat": they need banding OR voronoi OR noise texture (diffuse+normal).
- No pure solid-color spheres in the main catalog — sun must be emissive.
- GLB materials get `applyProceduralMaterials` overrides (roughness 0.8, metalness 0.1, normalScale 1.5) — verify after swapping a GLB that procedural overrides still fire.
- Rings must not clip the planet (innerRadius > 1.0) and should be faint for gas giants except Saturn.
- Keep textures procedural (zero network cost) — only real NASA maps for bodies with GLBs; `pluto` is the only dwarf with an embedded real map.
