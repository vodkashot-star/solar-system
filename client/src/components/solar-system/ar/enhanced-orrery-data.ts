import { BODIES, type Body } from "../bodies";

export type ARScaleMode = "table" | "large" | "inner" | "outer" | "deep";

export type EnhancedOrreryBody = {
  id: string;
  name: string;
  type: "star" | "planet" | "dwarfPlanet" | "asteroid" | "comet" | "interstellar" | "spacecraft";
  /** Orbit radius from the sun in AR units for each scale mode */
  orbitRadius: Record<ARScaleMode, number>;
  /** Visual radius in AR units for each scale mode */
  visualRadius: Record<ARScaleMode, number>;
  /** Visual orbital speed, rad/s at speed 1 */
  orbitSpeed: number;
  /** Visual spin speed, rad/s */
  spinSpeed: number;
  /** Axial tilt, radians */
  tilt: number;
  /** Initial orbital angle, radians */
  phase: number;
  /** Fallback color */
  color: string;
  /** Full GLB (used in Focus mode) */
  glbUrl?: string;
  hasRings?: boolean;
  /** For spacecraft: parent body they orbit */
  parentBody?: string;
  /** Moons for this body */
  moons: EnhancedOrreryMoon[];
  /** Which scale modes this body appears in */
  scaleVisibility: ARScaleMode[];
  /** Original body reference */
  body: Body;
};

export type EnhancedOrreryMoon = {
  id: string;
  name: string;
  /** Orbit radius from parent body in AR units */
  orbitRadius: Record<ARScaleMode, number>;
  /** Visual radius in AR units */
  visualRadius: Record<ARScaleMode, number>;
  /** Visual orbital speed, rad/s at speed 1 */
  orbitSpeed: number;
  /** Initial orbital angle, radians */
  phase?: number;
  /** Axial tilt, radians */
  tilt: number;
  /** Orbital eccentricity */
  eccentricity: number;
  /** Fallback color */
  color: string;
  /** Full GLB (used in Focus mode) */
  glbUrl?: string;
};

// Scale definitions - each mode shows different ranges of the solar system
export const SCALE_DEFINITIONS: Record<ARScaleMode, {
  name: string;
  description: string;
  sunRadius: number;
  systemRadius: number; // Maximum orbit radius
  baseScale: number; // Multiplier for converting astronomical units
}> = {
  table: {
    name: "Tabletop",
    description: "Complete solar system on a table (~50cm)",
    sunRadius: 0.012,
    systemRadius: 0.25,
    baseScale: 1.0
  },
  large: {
    name: "Room Scale", 
    description: "Full system fills a room (~2m)",
    sunRadius: 0.048,
    systemRadius: 1.0,
    baseScale: 4.0
  },
  inner: {
    name: "Inner System",
    description: "Sun to Mars + asteroid belt (~1m)",
    sunRadius: 0.06,
    systemRadius: 0.5,
    baseScale: 8.0
  },
  outer: {
    name: "Outer System", 
    description: "Jupiter to Neptune + Kuiper Belt (~2m)",
    sunRadius: 0.02,
    systemRadius: 1.0,
    baseScale: 2.0
  },
  deep: {
    name: "Deep Space",
    description: "Spacecraft missions + interstellar objects (~3m)",
    sunRadius: 0.01,
    systemRadius: 1.5,
    baseScale: 1.5
  }
};

// Utility functions to convert astronomical data to AR scale
function scaleOrbitRadius(astronomicalAU: number, mode: ARScaleMode): number {
  const scale = SCALE_DEFINITIONS[mode];
  // Non-linear scaling for better visual distribution
  const logScale = Math.log10(Math.max(astronomicalAU, 0.1) + 1) * 0.15;
  return Math.min(logScale * scale.baseScale, scale.systemRadius * 0.9);
}

function scaleBodyRadius(earthRadii: number, mode: ARScaleMode, bodyType: string): number {
  const scale = SCALE_DEFINITIONS[mode];
  let baseRadius = earthRadii * 0.008; // Base Earth size in AR
  
  // Enhance small bodies for visibility
  if (bodyType === "asteroid" || bodyType === "comet" || bodyType === "spacecraft") {
    baseRadius = Math.max(baseRadius, 0.003); // Minimum size
  }
  
  return baseRadius * scale.baseScale;
}

// Create enhanced orrery bodies from the main catalog
export function createEnhancedOrreryBodies(): EnhancedOrreryBody[] {
  const enhancedBodies: EnhancedOrreryBody[] = [];
  
  for (const body of BODIES) {
    // Skip moon - it's handled as Earth's moon
    if (body.id === "moon") continue;
    
    // Determine which scales this body appears in
    const scaleVisibility: ARScaleMode[] = [];
    
    switch (body.type) {
      case "star":
        scaleVisibility.push("table", "large", "inner", "outer", "deep");
        break;
      case "planet":
        if (body.properties.semiMajorAxis <= 1.6) { // Inner planets
          scaleVisibility.push("table", "large", "inner");
        } else { // Outer planets
          scaleVisibility.push("table", "large", "outer");
        }
        break;
      case "dwarfPlanet":
        if (body.properties.semiMajorAxis <= 5) { // Ceres
          scaleVisibility.push("table", "large", "inner");
        } else { // Kuiper Belt objects
          scaleVisibility.push("table", "large", "outer");
        }
        break;
      case "asteroid":
        if (body.properties.semiMajorAxis <= 5) { // Main belt + NEOs
          scaleVisibility.push("table", "large", "inner");
        } else { // Outer asteroids
          scaleVisibility.push("table", "large", "outer");
        }
        break;
      case "comet":
      case "interstellar":
        scaleVisibility.push("table", "large", "deep");
        break;
      case "spacecraft":
        scaleVisibility.push("deep");
        // Also add to parent body's scale if it has one
        if (body.parentBody) {
          const parent = BODIES.find(b => b.id === body.parentBody);
          if (parent && parent.properties.semiMajorAxis <= 1.6) {
            scaleVisibility.push("inner");
          } else {
            scaleVisibility.push("outer");
          }
        }
        break;
    }
    
    // Create orbit radius and visual radius for each scale mode
    const orbitRadius: Record<ARScaleMode, number> = {} as Record<ARScaleMode, number>;
    const visualRadius: Record<ARScaleMode, number> = {} as Record<ARScaleMode, number>;
    
    for (const mode of ["table", "large", "inner", "outer", "deep"] as ARScaleMode[]) {
      orbitRadius[mode] = scaleOrbitRadius(body.properties.semiMajorAxis, mode);
      visualRadius[mode] = scaleBodyRadius(body.properties.radius, mode, body.type);
    }
    
    // Handle moons (currently only Earth's moon for simplicity)
    const moons: EnhancedOrreryMoon[] = [];
    if (body.id === "earth") {
      const moon = BODIES.find(b => b.id === "moon");
      if (moon) {
        const moonOrbitRadius: Record<ARScaleMode, number> = {} as Record<ARScaleMode, number>;
        const moonVisualRadius: Record<ARScaleMode, number> = {} as Record<ARScaleMode, number>;
        
        for (const mode of ["table", "large", "inner", "outer", "deep"] as ARScaleMode[]) {
          // Moon orbital radius relative to Earth
          moonOrbitRadius[mode] = visualRadius[mode] * 3; // Approximately scaled
          moonVisualRadius[mode] = scaleBodyRadius(moon.properties.radius, mode, "dwarfPlanet");
        }
        
        moons.push({
          id: "moon",
          name: "Moon",
          orbitRadius: moonOrbitRadius,
          visualRadius: moonVisualRadius,
          orbitSpeed: 0.4,
          phase: 0,
          tilt: 0.12,
          eccentricity: 0.055,
          color: "#aaaaaa",
          glbUrl: moon.glbUrl
        });
      }
    }
    
    enhancedBodies.push({
      id: body.id,
      name: body.name,
      type: body.type,
      orbitRadius,
      visualRadius,
      orbitSpeed: body.orbitSpeed,
      spinSpeed: body.spinSpeed,
      tilt: body.tilt,
      phase: body.phase,
      color: body.color,
      glbUrl: body.glbUrl,
      hasRings: body.hasRings,
      parentBody: body.parentBody,
      moons,
      scaleVisibility,
      body
    });
  }
  
  return enhancedBodies;
}

// Get bodies visible in a specific scale mode
export function getBodiesForScale(mode: ARScaleMode): EnhancedOrreryBody[] {
  const allBodies = createEnhancedOrreryBodies();
  return allBodies.filter(body => body.scaleVisibility.includes(mode));
}

// Scale-specific configurations
export const ENHANCED_ORRERY_CONFIG = {
  scales: SCALE_DEFINITIONS,
  getBodiesForScale,
  createEnhancedOrreryBodies,
  
  // Helper to get sun configuration for a scale mode
  getSunConfig: (mode: ARScaleMode) => {
    const scale = SCALE_DEFINITIONS[mode];
    return {
      radius: scale.sunRadius,
      intensity: scale.baseScale * 0.8,
      position: [0, 0, 0] as [number, number, number]
    };
  },
  
  // Helper to get orbit ring visibility
  shouldShowOrbitRings: (mode: ARScaleMode): boolean => {
    return mode !== "deep"; // Hide orbit rings in deep space mode
  }
};