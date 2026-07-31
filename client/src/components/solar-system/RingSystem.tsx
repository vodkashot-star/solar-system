/**
 * RingSystem.tsx
 *
 * Renders planetary ring systems with astronomically accurate parameters.
 * Supports Saturn, Jupiter, Uranus, Neptune, and Haumea.
 */

import { useMemo } from "react";
import * as THREE from "three";
import type { Body } from "./bodies";

interface RingParameters {
  innerRadius: number;   // Planet radii
  outerRadius: number;   // Planet radii
  inclination: number;   // Degrees, relative to planet equator
  opticalDepth: number;  // 0-1, affects opacity
  color: string;
  segments: number;
}

const RING_PARAMETERS: Record<string, RingParameters> = {
  saturn: {
    innerRadius: 1.24,
    outerRadius: 2.27,
    inclination: 26.7,
    opticalDepth: 0.8,
    color: "#c8b88a",
    segments: 128,
  },
  jupiter: {
    innerRadius: 1.72,
    outerRadius: 1.81,
    inclination: 3.1,
    opticalDepth: 0.01,
    color: "#8b7d6b",
    segments: 64,
  },
  uranus: {
    innerRadius: 1.59,
    outerRadius: 2.00,
    inclination: 97.8,
    opticalDepth: 0.1,
    color: "#7a7a7a",
    segments: 64,
  },
  neptune: {
    innerRadius: 1.72,
    outerRadius: 2.54,
    inclination: 28.3,
    opticalDepth: 0.05,
    color: "#5a5a7a",
    segments: 64,
  },
  haumea: {
    innerRadius: 1.4,
    outerRadius: 1.8,
    inclination: 0,
    opticalDepth: 0.3,
    color: "#a0a0b0",
    segments: 32,
  },
};

function createRingMaterial(params: RingParameters): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: params.color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: Math.min(params.opticalDepth * 1.2, 0.8),
    depthWrite: false,
  });
}

function createRingGeometry(params: RingParameters, planetRadius: number): THREE.RingGeometry {
  return new THREE.RingGeometry(
    planetRadius * params.innerRadius,
    planetRadius * params.outerRadius,
    params.segments,
    4
  );
}

interface RingSystemProps {
  body: Body;
  planetRadius: number;
}

export default function RingSystem({ body, planetRadius }: RingSystemProps) {
  const ringParams = RING_PARAMETERS[body.id];
  
  if (!ringParams) return null;

  const geometry = useMemo(
    () => createRingGeometry(ringParams, planetRadius),
    [body.id, planetRadius]
  );

  const material = useMemo(
    () => createRingMaterial(ringParams),
    [body.id]
  );

  // Rendered inside Planet's spin group, which already applies body.tilt,
  // so the ring plane lies flat relative to the tilted equator.
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      onClick={(e) => e.stopPropagation()}
      onPointerOver={(e) => e.stopPropagation()}
      onPointerOut={(e) => e.stopPropagation()}
    />
  );
}

export { RING_PARAMETERS, type RingParameters };