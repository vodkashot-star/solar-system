/**
 * custom-bodies.ts
 *
 * Bridges the `celestial_bodies` Postgres table (exposed via /api/bodies) with
 * the client-side `Body` catalog. The static BODIES list in bodies.ts stays
 * canonical; custom bodies from the API are mapped into Body objects with
 * sensible scene defaults and merged in by useCustomBodies / SolarSystem.
 *
 * All fetches fail silently (return []) so the app works with no backend.
 */

import type { Body, BodyType, AstronomicalProperties } from "@/components/solar-system/bodies";
import { BODY_TYPE_COLORS } from "@/components/solar-system/bodies";
import { API_BASE } from "@/lib/config";

export type CustomBodyRow = {
  id: number;
  name: string;
  type: string;
  mass: number | null;
  radius: number | null;
  density: number | null;
  gravity: number | null;
  temperature: number | null;
  orbitalPeriod: number | null;
  semiMajorAxis: number | null;
  eccentricity: number | null;
  inclination: number | null;
  rotationPeriod: number | null;
  axialTilt: number | null;
  aiClassification: string | null;
  aiConfidenceScore: number | null;
  visualRadius: number | null;
  orbit: number | null;
  orbitSpeed: number | null;
  spinSpeed: number | null;
  tilt: number | null;
  phase: number | null;
  color: string | null;
  fact: string | null;
  parentBody: string | null;
  hasRings: string | null;
};

/** Custom bodies get a `custom-<dbId>` id so they never collide with the static catalog. */
export function customBodyId(dbId: number): string {
  return `custom-${dbId}`;
}

export function isCustomBodyId(id: string): boolean {
  return id.startsWith("custom-");
}

const TYPE_ALIASES: Record<string, BodyType> = {
  star: "star",
  planet: "planet",
  dwarfplanet: "dwarfPlanet",
  "dwarf planet": "dwarfPlanet",
  asteroid: "asteroid",
  comet: "comet",
  interstellar: "interstellar",
  spacecraft: "spacecraft",
  moon: "planet",
  satellite: "spacecraft",
};

export function mapBodyType(raw: string): BodyType {
  return TYPE_ALIASES[raw.trim().toLowerCase()] ?? "asteroid";
}

/**
 * Map a DB row to a renderable Body. Scene params come from the row when set,
 * otherwise they are derived from the astronomical properties with the same
 * scale conventions as the static catalog (earth: orbit 12.5, visualRadius 0.8,
 * orbitSpeed 0.13).
 */
export function mapCustomBodyRow(row: CustomBodyRow): Body {
  const type = mapBodyType(row.type);
  const radius = row.radius ?? 1;

  const orbit = row.orbit ?? Math.max(5, Math.min(55, (row.semiMajorAxis ?? 0.5) * 12.5));
  const visualRadius = row.visualRadius ?? Math.max(0.3, Math.min(4, radius * 0.8));
  const orbitSpeed = row.orbitSpeed ?? Math.max(0.02, 1.6 / orbit);
  const tilt = row.tilt ?? ((row.axialTilt ?? 0) * Math.PI) / 180;
  const phase = row.phase ?? ((row.id % 64) / 64) * Math.PI * 2;
  const color = row.color ?? BODY_TYPE_COLORS[type];

  const properties: AstronomicalProperties = {
    mass: row.mass ?? 0,
    radius,
    density: row.density ?? 0,
    gravity: row.gravity ?? 0,
    temperature: row.temperature ?? 0,
    orbitalPeriod: row.orbitalPeriod ?? 0,
    semiMajorAxis: row.semiMajorAxis ?? 0,
    eccentricity: row.eccentricity ?? 0,
    inclination: row.inclination ?? 0,
    rotationPeriod: row.rotationPeriod ?? 0,
    axialTilt: row.axialTilt ?? 0,
  };

  return {
    id: customBodyId(row.id),
    type,
    name: row.name,
    visualRadius,
    orbit,
    orbitSpeed,
    spinSpeed: row.spinSpeed ?? 0.1,
    tilt,
    fact: row.fact ?? `${row.name} — custom body from the celestial catalog.`,
    phase,
    color,
    hasRings: row.hasRings === "true",
    properties,
    ...(row.parentBody ? { parentBody: row.parentBody } : {}),
  };
}

/** Fetch all custom bodies. Silently returns [] on any failure. */
export async function fetchCustomBodies(): Promise<Body[]> {
  try {
    const res = await fetch(`${API_BASE}/bodies`);
    if (!res.ok) return [];
    const rows: CustomBodyRow[] = await res.json();
    return rows.map(mapCustomBodyRow);
  } catch {
    return [];
  }
}

export type CreateCustomBodyInput = {
  name: string;
  type: BodyType;
  color?: string;
  orbit?: number;
  orbitSpeed?: number;
  spinSpeed?: number;
  visualRadius?: number;
  fact?: string;
  parentBody?: string;
};

/** Create a custom body. Returns the mapped Body, or null on failure. */
export async function createCustomBody(input: CreateCustomBodyInput): Promise<Body | null> {
  try {
    const res = await fetch(`${API_BASE}/bodies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    return mapCustomBodyRow((await res.json()) as CustomBodyRow);
  } catch {
    return null;
  }
}

/** Delete a custom body by its DB id (from a `custom-<id>` Body id). */
export async function deleteCustomBody(bodyId: string): Promise<boolean> {
  if (!isCustomBodyId(bodyId)) return false;
  const dbId = bodyId.slice("custom-".length);
  try {
    const res = await fetch(`${API_BASE}/bodies/${dbId}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}
