---
name: orbit-tuning
description: Use when tuning orbital motion in the solar-system scene — "planets move too fast/slow", "orbits look wrong", spacecraft offset issues, scale/speed multipliers, Kepler solver or hyperbolic (Voyager) orbit work.
---

# Orbit Tuning

Orbital/visual motion lives in the client. The bodies catalog is
`client/src/components/solar-system/bodies.ts` (NOT a `data/` dir) and the
solver is `client/src/lib/kepler.ts`.

## Per-body tuning knobs (`bodies.ts`)

| Field | Effect |
|-------|--------|
| `orbit` | Orbit radius in scene units (before `scaleMultiplier`) |
| `orbitSpeed` | Mean motion (rad/s of mean anomaly) — multiplier on `speedMultiplier` |
| `phase` | Starting mean anomaly (rad) — where the body starts on its orbit |
| `spinSpeed` | Self-rotation (rad/s of spin angle) |
| `visualRadius` | Rendered sphere/GLB scale (logarithmic-ish scene radius) |
| `eccentricity` | 0 = circle; >0 = ellipse via `solveKepler` |
| `parentBody` | Spacecraft/moons: orbit this body instead of the Sun |

## Global multipliers

- `speedMultiplier` — passed from SolarSystem down to Planet/SpacecraftOrbit;
  scales mean anomaly rate AND spin. 0 = paused (skips position writes).
- `scaleMultiplier` — scales orbit radii AND visual radius:
  `effectiveOrbit = body.orbit * scaleMultiplier`; radius uses
  `RADIUS_SCALE_MIN + RADIUS_SCALE_WEIGHT * scaleMultiplier` so bodies never
  vanish at small scales (`Planet.tsx` line ~16/18/196-197).

## Kepler solver (`kepler.ts`)

- `solveKepler(M, e)` — dispatches: `solveKeplerElliptic` for e<1,
  `solveKeplerHyperbolic` for e>1. Voyager 1/2 use hyperbolic orbits —
  keep the dispatcher, a linear substitution breaks their paths.
- Per-frame flow in `Planet.tsx` (line ~235-241):
  `getHeliocentricPosition(body.id, elapsedTime, speedMultiplier, effectiveOrbit)`
  for special bodies, else `E = solveKepler(body.phase + elapsed * orbitSpeed * speedMultiplier, e)`.

## Spacecraft / moon offsets (`SpacecraftOrbit.tsx`)

- `position` prop is a parent-relative offset (lives in a ref inside `useFrame`
  — refs, not props, because refs don't trigger re-render).
- The wrapper copies `parentPositionRef.current[parentBody ?? "sun"]` and adds
  the offset; `onPosition` reports world position (local + group translation).
- Tuning a spacecraft = change its `position` offset and/or `body.parentBody`.
  Distance from parent must fit `effectiveOrbit` scales or it will clip
  through the parent.

## Visual sanity checks

- Pause (`speedMultiplier = 0`) should freeze everything except the cinematic
  tour — no drift, no spin.
- Elliptical orbits must return to start after one period: `phase` mod `2π`.
- Inner planets must lap outer ones (orbitSpeed ordering); if an inner planet
  lags, its `orbitSpeed` is too low relative to radius.
- frameloop="demand": any new useFrame writing positions must call
  `state.invalidate()` (see `frameloop-demand` skill).
