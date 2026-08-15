import { HelioVector, Ecliptic, Body } from "astronomy-engine"

export const ASTRONOMY_BODIES = new Set([
  "sun", "mercury", "venus", "earth", "mars",
  "jupiter", "saturn", "uranus", "neptune"
])

// Simulated days per real second at 1x speed. Tuned so inner-planet orbital
// motion is clearly visible at the default speed (Mercury ~60s/orbit, Earth
// ~4min); outer planets remain slow, as in reality.
export const SIM_SPEED = 1.5

const REF_EPOCH = new Date(Date.UTC(2000, 0, 1, 12, 0, 0))
const SECONDS_PER_DAY = 86400

const BODY_MAP: Record<string, string> = {
  sun: "Sun", mercury: "Mercury", venus: "Venus",
  earth: "Earth", mars: "Mars", jupiter: "Jupiter",
  saturn: "Saturn", uranus: "Uranus", neptune: "Neptune",
}

export function getHeliocentricPosition(
  bodyId: string,
  elapsedSeconds: number,
  speedMultiplier: number,
  orbitRadius: number,
): { x: number; y: number; z: number } | null {
  const days = elapsedSeconds * speedMultiplier * SIM_SPEED
  return getHeliocentricPositionAtDays(bodyId, days, orbitRadius)
}

export function getHeliocentricPositionAtDays(
  bodyId: string,
  daysSinceJ2000: number,
  orbitRadius: number,
): { x: number; y: number; z: number } | null {
  if (!ASTRONOMY_BODIES.has(bodyId)) return null

  const date = new Date(REF_EPOCH.getTime() + daysSinceJ2000 * SECONDS_PER_DAY * 1000)

  const vec = HelioVector(BODY_MAP[bodyId] as Body, date)
  const ecl = Ecliptic(vec)

  // Normalize the real ephemeris direction and scale to scene orbit radius.
  // This keeps real orbital paths (inclination, eccentricity direction changes)
  // while maintaining the visual orbit distance the scene is built around.
  const dist = Math.sqrt(ecl.vec.x ** 2 + ecl.vec.y ** 2 + ecl.vec.z ** 2)
  if (dist < 1e-10) return { x: 0, y: 0, z: 0 }

  const scale = orbitRadius / dist
  return {
    x: ecl.vec.x * scale,
    y: ecl.vec.z * scale,   // map ecliptic Z → scene Y (up)
    z: ecl.vec.y * scale,   // map ecliptic Y → scene Z
  }
}
