import { describe, it, expect } from "vitest";
import { BODIES, BODY_TYPE_COLORS } from "@/components/solar-system/bodies";
import type { BodyType } from "@/components/solar-system/bodies";

const VALID_TYPES: BodyType[] = ["star", "planet", "dwarfPlanet", "asteroid", "comet", "interstellar"];

describe("BODIES data integrity", () => {
  it("exports 29 celestial bodies", () => {
    expect(BODIES).toHaveLength(29);
  });

  it.each(BODIES)("$name has valid type", (body) => {
    expect(VALID_TYPES).toContain(body.type);
  });

  it.each(BODIES)("$name has positive visualRadius", (body) => {
    expect(body.visualRadius).toBeGreaterThan(0);
  });

  it.each(BODIES)("$name has a fact string", (body) => {
    expect(body.fact).toBeTruthy();
    expect(typeof body.fact).toBe("string");
  });

  it("every body has a unique id", () => {
    const ids = BODIES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(BODIES)("$name has expected AstronomicalProperties keys", (body) => {
    const requiredKeys = [
      "mass", "radius", "density", "gravity", "temperature",
      "orbitalPeriod", "semiMajorAxis", "eccentricity", "inclination",
      "rotationPeriod", "axialTilt",
    ] as const;
    for (const key of requiredKeys) {
      expect(body.properties).toHaveProperty(key);
    }
  });

  it("sun is the only star", () => {
    const stars = BODIES.filter((b) => b.type === "star");
    expect(stars).toHaveLength(1);
    expect(stars[0].id).toBe("sun");
  });

  it("has 8 planets", () => {
    expect(BODIES.filter((b) => b.type === "planet")).toHaveLength(8);
  });

  it("Saturn has rings", () => {
    const saturn = BODIES.find((b) => b.id === "saturn");
    expect(saturn?.hasRings).toBe(true);
  });
});

describe("BODY_TYPE_COLORS", () => {
  it.each(VALID_TYPES)("has color for %s", (type) => {
    expect(BODY_TYPE_COLORS[type]).toBeTruthy();
    expect(BODY_TYPE_COLORS[type]).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
