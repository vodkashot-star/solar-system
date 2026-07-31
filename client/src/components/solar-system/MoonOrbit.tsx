/**
 * MoonOrbit.tsx
 *
 * Positions a moon GLB relative to its parent planet each frame.
 * Follows the same pattern as SpacecraftOrbit.tsx but with astronomically
 * accurate orbital parameters from the body's properties.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Body } from "./bodies";
import Planet from "./Planet";
import { solveKepler } from "@/lib/kepler";

type MoonOrbitProps = {
  body: Body;
  /** Live world-space position ref of the parent body (from positions.current). */
  parentPositionRef: React.MutableRefObject<Record<string, THREE.Vector3>>;
  onPosition?: (pos: THREE.Vector3) => void;
  scaleMultiplier?: number;
  onComputedRadius?: (bodyId: string, radius: number) => void;
  onHover?: (bodyId: string | null) => void;
  speedMultiplier?: number;
};

// Scratch vectors — reused every frame to avoid allocations.
const _parentPos = new THREE.Vector3();
const _reportedPos = new THREE.Vector3();

export default function MoonOrbit({
  body,
  parentPositionRef,
  onPosition,
  scaleMultiplier = 1,
  onComputedRadius,
  onHover,
  speedMultiplier = 1,
}: MoonOrbitProps) {
  const groupRef = useRef<THREE.Group>(null);

  /**
   * Build a modified body that orbits at the desired radius around origin.
   * MoonOrbit will translate the whole group to parentPosition, so
   * Planet just needs to think it's orbiting origin at the moon's orbital radius.
   * We use the body's actual orbital parameters (eccentricity, inclination).
   */
  const localBody: Body = {
    ...body,
    orbit: body.orbit,
    // Keep the moon's actual orbitSpeed so it circles the parent correctly.
  };

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const parentPos = parentPositionRef.current[body.parentBody ?? "sun"];

    if (!parentPos) {
      group.visible = false;
      state.invalidate();
      return;
    }

    group.visible = true;

    _parentPos.copy(parentPos);
    group.position.copy(_parentPos);

    state.invalidate();
  });

  /**
   * Intercept onPosition from Planet. Planet reports its local position
   * (relative to group origin, which equals parentPosition). We add the
   * group's current world translation to get the true world position.
   */
  const handlePosition = (localPos: THREE.Vector3) => {
    if (!groupRef.current) return;
    _reportedPos.copy(localPos).add(groupRef.current.position);
    onPosition?.(_reportedPos);
  };

  return (
    <group ref={groupRef}>
      <Planet
        body={localBody}
        onPosition={handlePosition}
        scaleMultiplier={scaleMultiplier}
        onComputedRadius={onComputedRadius}
        onHover={onHover}
        speedMultiplier={speedMultiplier}
      />
    </group>
  );
}