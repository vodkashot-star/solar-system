# Astronomy Engine — Real Planet Orbits

**Status:** Implemented — `client/src/lib/astronomy-positions.ts` supplies real
ephemeris positions; consumed by `OrbitRings.tsx` and `Planet.tsx`. Dwarf
planets, asteroids, comets, and spacecraft keep simplified orbits as planned.

Replace the hand-tuned Keplerian orbits for the 8 planets + Sun with real ephemeris
positions from [astronomy-engine](https://github.com/cosinekitty/astronomy) (pure JS,
offline, no SPICE or API calls). Dwarf planets, asteroids, comets, and spacecraft keep
their current simplified orbits.

---

## Implementation

### 1. Install

- [x] Install `astronomy-engine` dependency

```bash
npm install astronomy-engine
```

### 2. New file: `client/src/lib/astronomy-positions.ts`

- [x] Create module with `getHeliocentricPosition`, `ASTRONOMY_BODIES`, `AU_SCALE`, `SIM_SPEED`

Central module that maps simulation elapsed time → real heliocentric ecliptic position.

```typescript
import { HelioVector, Ecliptic } from "astronomy-engine"

// Bodies supported by the library (Sun + 8 planets)
export const ASTRONOMY_BODIES = new Set([
  "sun", "mercury", "venus", "earth", "mars",
  "jupiter", "saturn", "uranus", "neptune"
])

export const AU_SCALE = 7  // scene units per AU — tune for visual fit
const REF_EPOCH = new Date(Date.UTC(2000, 0, 1, 12, 0, 0))  // J2000
const SECONDS_PER_DAY = 86400
const SIM_SPEED = 0.5  // 1 wall-second = 0.5 real days of ephemeris

const BODY_MAP: Record<string, string> = {
  sun: "Sun", mercury: "Mercury", venus: "Venus",
  earth: "Earth", mars: "Mars", jupiter: "Jupiter",
  saturn: "Saturn", uranus: "Uranus", neptune: "Neptune",
}

export function getHeliocentricPosition(
  bodyId: string,
  elapsedSeconds: number,
  speedMultiplier: number,
): { x: number; y: number; z: number } | null {
  if (!ASTRONOMY_BODIES.has(bodyId)) return null

  const days = elapsedSeconds * speedMultiplier * SIM_SPEED
  const date = new Date(REF_EPOCH.getTime() + days * SECONDS_PER_DAY * 1000)

  const vec = HelioVector(BODY_MAP[bodyId] as any, date)
  // EQJ → ecliptic for y-up scene orientation
  const ecl = Ecliptic(vec)
  return {
    x: ecl.vec.x * AU_SCALE,
    y: ecl.vec.z * AU_SCALE,  // ecliptic north → scene Y
    z: ecl.vec.y * AU_SCALE,  // ecliptic east → scene Z
  }
}
```

### 3. Modify `Planet.tsx:useFrame`

- [x] Add import and branch in `useFrame` for `ASTRONOMY_BODIES`

Add a branch before the Kepler solver — if `body.id` is in `ASTRONOMY_BODIES`,
call `getHeliocentricPosition` and set `pivot.position` directly.

- New import: `import { getHeliocentricPosition, ASTRONOMY_BODIES } from "@ ..."`
- In `useFrame`, before the `solveKepler` block:

```typescript
if (ASTRONOMY_BODIES.has(body.id)) {
  const pos = getHeliocentricPosition(body.id, state.clock.elapsedTime, speedMultiplier)
  if (pos) { p.position.set(pos.x, pos.y, pos.z) }
} else {
  // existing Kepler path ...
}
```

Details to handle:
- `isStationary` check still respected (Sun with `orbitSpeed: 0` → `HelioVector("Sun", date)` returns origin)
- Cinematic juggle still applies after position set
- `onPosition` callback still fires

### 4. Modify `OrbitRings.tsx`

- [x] Add `sampleEphemerisPoints` function and use it for `ASTRONOMY_BODIES`

In `sampleOrbitPoints`, for astronomy-engine bodies, pre-sample `getHeliocentricPosition`
at N evenly-spaced time offsets across one orbital period (approximate — use the
body's `orbitalPeriod` property as a hint for sampling window).

Kepler sampling path stays for non-astronomy bodies.

Hard part: orbit ring needs to match where the body actually is at any given time.
Simplest approach — sample the full ephemeris across the visible time window every time,
since `OrbitRings` recomputes geometry only on mount (empty deps in `useMemo`). If orbits
shift over the session, switch `useMemo` → `useState` + recompute periodically.

### 5. Modify `bodies.ts`

- [x] No functional change — `orbitSpeed`/`phase`/`eccentricity` already display-only for data panel; motion code path now branches before reaching them

The 9 astronomy bodies no longer use `orbitSpeed`, `phase`, or `eccentricity` for
motion — these fields become display-only (shown in UI data explorer). Keep them
for data panel consistency but strip any dependency from the motion code path.

### 6. Leave untouched

- `SpacecraftOrbit.tsx` — spacecraft still use parent-relative circular offset
- `CinematicTour.tsx` — reads `positions.current` which updates every frame from Planet
- `FocusCamera.tsx` — same, reads `positions.current`
- `AIClassificationPanel`, `BodyDetailModal`, `ScaleControl`, all UI — unchanged
- `frameloop="demand"` + `state.invalidate()` — still required

---

## Files to touch

| File | Change | Status |
|------|--------|--------|
| `package.json` | add `astronomy-engine` dependency, bump `1.2.0` → `1.3.0` | ✅ |
| `client/src/lib/astronomy-positions.ts` | **new** — ephemeris lookup module | ✅ |
| `client/src/components/solar-system/Planet.tsx` | branch in `useFrame` for ASTRONOMY_BODIES | ✅ |
| `client/src/components/solar-system/OrbitRings.tsx` | ephemeris sampling for orbit rings | ✅ |
| `client/src/components/solar-system/bodies.ts` | no functional change, just data | ✅ |
| `client/src/test/bodies.test.ts` | no changes needed | ✅ |

---

## Tuning knobs

| Constant | File | Default | Effect |
|----------|------|---------|--------|
| `AU_SCALE` | `astronomy-positions.ts` | 7 | Scene units per AU. Saturn ~9.58 AU → ~67 units. Higher = more spread out. |
| `SIM_SPEED` | `astronomy-positions.ts` | 0.5 | Real days per wall-second. 0.5 = 1 day per 2 seconds. Higher = faster orbits. |
| Orbit ring sample count | `OrbitRings.tsx` | 128 | Segments for ring geometry. Higher = smoother rings for high-eccentricity bodies. |

Start with `AU_SCALE = 7` and `SIM_SPEED = 0.5`, then launch the tour and adjust by feel
until the scene matches the previous visual scale and pacing.
