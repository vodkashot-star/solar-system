import { HelioVector, Ecliptic } from "astronomy-engine"

export const ASTRONOMY_BODIES = new Set([
  "sun", "mercury", "venus", "earth", "mars",
  "jupiter", "saturn", "uranus", "neptune"
])

export const AU_SCALE = 7
export const SIM_SPEED = 0.5

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
): { x: number; y: number; z: number } | null {
  if (!ASTRONOMY_BODIES.has(bodyId)) return null

  const days = elapsedSeconds * speedMultiplier * SIM_SPEED
  const date = new Date(REF_EPOCH.getTime() + days * SECONDS_PER_DAY * 1000)

  const vec = HelioVector(BODY_MAP[bodyId] as any, date)
  const ecl = Ecliptic(vec)
  return {
    x: ecl.vec.x * AU_SCALE,
    y: ecl.vec.z * AU_SCALE,
    z: ecl.vec.y * AU_SCALE,
  }
}
