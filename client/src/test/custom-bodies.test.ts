import { describe, it, expect } from "vitest";
import {
  mapCustomBodyRow,
  mapBodyType,
  customBodyId,
  isCustomBodyId,
  type CustomBodyRow,
} from "@/lib/custom-bodies";
import { BODY_TYPE_COLORS } from "@/components/solar-system/bodies";

const BASE_ROW: CustomBodyRow = {
  id: 7,
  name: "Test World",
  type: "planet",
  mass: 1, radius: 1, density: 5.5, gravity: 9.8, temperature: 288,
  orbitalPeriod: 365, semiMajorAxis: 1, eccentricity: 0.02, inclination: 1,
  rotationPeriod: 24, axialTilt: 23.4,
  aiClassification: null, aiConfidenceScore: null,
  visualRadius: null, orbit: null, orbitSpeed: null, spinSpeed: null,
  tilt: null, phase: null, color: null, fact: null, parentBody: null,
  hasRings: "false",
};

describe("mapCustomBodyRow", () => {
  it("maps scene params from the row when present", () => {
    const body = mapCustomBodyRow({
      ...BASE_ROW,
      visualRadius: 2.5,
      orbit: 30,
      orbitSpeed: 0.05,
      spinSpeed: 0.3,
      tilt: 0.5,
      phase: 1.2,
      color: "#ff0000",
      fact: "A test fact",
      parentBody: "earth",
      hasRings: "true",
    });
    expect(body.id).toBe("custom-7");
    expect(body.name).toBe("Test World");
    expect(body.type).toBe("planet");
    expect(body.visualRadius).toBe(2.5);
    expect(body.orbit).toBe(30);
    expect(body.orbitSpeed).toBe(0.05);
    expect(body.spinSpeed).toBe(0.3);
    expect(body.tilt).toBe(0.5);
    expect(body.phase).toBe(1.2);
    expect(body.color).toBe("#ff0000");
    expect(body.fact).toBe("A test fact");
    expect(body.parentBody).toBe("earth");
    expect(body.hasRings).toBe(true);
  });

  it("derives scene defaults from astronomical properties (earth-like scale)", () => {
    const body = mapCustomBodyRow(BASE_ROW);
    expect(body.visualRadius).toBeCloseTo(0.8, 5);
    expect(body.orbit).toBeCloseTo(12.5, 5);
    expect(body.orbitSpeed).toBeCloseTo(0.128, 2);
    expect(body.tilt).toBeCloseTo((23.4 * Math.PI) / 180, 5);
    expect(body.spinSpeed).toBe(0.1);
    expect(body.color).toBe(BODY_TYPE_COLORS.planet);
    expect(body.fact).toContain("Test World");
    expect(body.hasRings).toBe(false);
  });

  it("caps derived orbit and clamps derived visualRadius", () => {
    const far = mapCustomBodyRow({ ...BASE_ROW, semiMajorAxis: 100 });
    expect(far.orbit).toBeLessThanOrEqual(55);
    const big = mapCustomBodyRow({ ...BASE_ROW, radius: 30 });
    expect(big.visualRadius).toBeLessThanOrEqual(4);
  });

  it("keeps the full astronomical properties passthrough", () => {
    const body = mapCustomBodyRow(BASE_ROW);
    expect(body.properties.mass).toBe(1);
    expect(body.properties.axialTilt).toBe(23.4);
    expect(body.properties.orbitalPeriod).toBe(365);
  });
});

describe("mapBodyType", () => {
  it("normalizes aliases to BodyType values", () => {
    expect(mapBodyType("planet")).toBe("planet");
    expect(mapBodyType("Dwarf Planet")).toBe("dwarfPlanet");
    expect(mapBodyType("comet")).toBe("comet");
    expect(mapBodyType("MOON")).toBe("planet");
    expect(mapBodyType("unknown-thing")).toBe("asteroid");
  });
});

describe("customBodyId helpers", () => {
  it("prefixes db ids and detects them", () => {
    expect(customBodyId(3)).toBe("custom-3");
    expect(isCustomBodyId("custom-3")).toBe(true);
    expect(isCustomBodyId("earth")).toBe(false);
  });
});
