/**
 * SpacecraftOrbit.tsx
 *
 * Positions a spacecraft GLB relative to its parent body each frame.
 *
 * Strategy: render <Planet> with orbit=0 (no sun-relative orbit) inside a
 * <group> that is translated to parentPosition every frame. This makes the
 * spacecraft orbit the parent using Planet's existing circular orbit logic
 * but with a small orbitRadius around the parent instead of the Sun.
 *
 * When parentPosition is undefined (parent not yet placed in the scene),
 * the group is hidden until it becomes available.
 *
 * Calls state.invalidate() every frame — required for frameloop="demand".
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Body } from "./bodies";
import Planet from "./Planet";

type SpacecraftOrbitProps = {
  body: Body;
  /** Live world-space position of the parent body (from positions.current). */
  parentPosition: THREE.Vector3 | undefined;
  /** Radius of the circular orbit around the parent, in scene units. */
  orbitRadius?: number;
  onPosition?: (pos: THREE.Vector3) => void;
  scaleMultiplier?: number;
  onComputedRadius?: (bodyId: string, radius: number) => void;
  onHover?: (bodyId: string | null) => void;
  speedMultiplier?: number;
};

// Scratch vectors — reused every frame to avoid allocations.
const _parentPos = new THREE.Vector3();
const _reportedPos = new THREE.Vector3();

export default function SpacecraftOrbit({
  body,
  parentPosition,
  orbitRadius = 1.8,
  onPosition,
  scaleMultiplier = 1,
  onComputedRadius,
  onHover,
  speedMultiplier = 1,
}: SpacecraftOrbitProps) {
  const groupRef = useRef<THREE.Group>(null);
  // Track whether the parent has ever been placed so we can un-hide the group.
  const everVisible = useRef(false);

  /**
   * Build a modified body that orbits at the desired radius around origin.
   * SpacecraftOrbit will translate the whole group to parentPosition, so
   * Planet just needs to think it's orbiting origin at orbitRadius.
   */
  const localBody: Body = {
    ...body,
    orbit: orbitRadius,
    // Keep the spacecraft's own orbitSpeed so it visibly circles the parent.
    // The phase offset makes each spacecraft start at a different angle.
  };

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    if (!parentPosition) {
      // Parent not placed yet — keep hidden.
      group.visible = false;
      state.invalidate();
      return;
    }

    // Reveal once parent is live.
    if (!everVisible.current) {
      group.visible = true;
      everVisible.current = true;
    }

    // Translate the group to the parent's current world position.
    _parentPos.copy(parentPosition);
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
    <group ref={groupRef} visible={false}>
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
