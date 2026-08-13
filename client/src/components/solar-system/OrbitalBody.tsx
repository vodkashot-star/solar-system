/**
 * OrbitalBody.tsx
 *
 * Positions a body (moon or spacecraft) relative to its parent body each frame.
 * Merged from the former MoonOrbit.tsx + SpacecraftOrbit.tsx — the two were
 * identical except that spacecraft override the orbital radius while moons
 * use their astronomical `body.orbit` parameters.
 *
 * Strategy: render <Planet> with orbit=0 (no sun-relative orbit) inside a
 * <group> that is translated to parentPosition every frame. This makes the
 * body orbit the parent using Planet's existing orbit logic but around the
 * parent instead of the Sun.
 *
 * When parentPosition is undefined (parent not yet placed in the scene),
 * the group is hidden until it becomes available.
 *
 * Calls state.invalidate() every frame — required for frameloop="demand".
 */

import React, { useRef, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Body } from "./bodies";
import Planet from "./Planet";
import { useSimulation } from "@/stores/simulation";

type OrbitalBodyProps = {
  body: Body;
  /** Live world-space position ref of the parent body (from positions.current). */
  parentPositionRef: React.MutableRefObject<Record<string, THREE.Vector3>>;
  /** Override for the orbital radius around the parent, in scene units.
   *  Omit for moons (uses the body's astronomical orbit parameters). */
  orbitRadius?: number;
  onPosition?: (pos: THREE.Vector3) => void;
  scaleMultiplier?: number;
  onComputedRadius?: (bodyId: string, radius: number) => void;
  onHover?: (bodyId: string | null) => void;
  speedMultiplier?: number;
  /** Lazy-load gate, forwarded to the inner Planet. */
  isWanted?: boolean;
};

// Scratch vectors — reused every frame to avoid allocations.
const _parentPos = new THREE.Vector3();
const _reportedPos = new THREE.Vector3();

export default React.memo(function OrbitalBody({
  body,
  parentPositionRef,
  orbitRadius,
  onPosition,
  scaleMultiplier = 1,
  onComputedRadius,
  onHover,
  speedMultiplier = 1,
  isWanted = true,
}: OrbitalBodyProps) {
  const groupRef = useRef<THREE.Group>(null);
  const speed = useSimulation((s) => s.speed);

  /**
   * Build a modified body that orbits at the desired radius around origin.
   * OrbitalBody will translate the whole group to parentPosition, so
   * Planet just needs to think it's orbiting origin at the orbital radius
   * (spacecraft) or the body's own parameters (moons). The body's actual
   * orbitSpeed is kept so it visibly circles the parent.
   */
  const localBody: Body = useMemo(
    () => ({
      ...body,
      orbit: orbitRadius ?? body.orbit,
    }),
    [body, orbitRadius],
  );

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const parentPos = parentPositionRef.current[body.parentBody ?? "sun"];

    if (!parentPos) {
      // Parent not placed yet — keep hidden.
      group.visible = false;
      state.invalidate();
      return;
    }

    // Reveal when parent is live.
    group.visible = true;

    // Translate the group to the parent's current world position.
    _parentPos.copy(parentPos);
    group.position.copy(_parentPos);

    // Skip when paused — the parent's own invalidate() (or the next unpause)
    // picks the group translation up on the next rendered frame anyway.
    if (speed > 0) {
      state.invalidate();
    }
  });

  /**
   * Intercept onPosition from Planet. Planet reports its local position
   * (relative to group origin, which equals parentPosition). We add the
   * group's current world translation to get the true world position.
   */
  const handlePosition = useCallback(
    (localPos: THREE.Vector3) => {
      if (!groupRef.current) return;
      _reportedPos.copy(localPos).add(groupRef.current.position);
      onPosition?.(_reportedPos);
    },
    [onPosition],
  );

  return (
    <group ref={groupRef}>
      <Planet
        body={localBody}
        onPosition={handlePosition}
        scaleMultiplier={scaleMultiplier}
        onComputedRadius={onComputedRadius}
        onHover={onHover}
        speedMultiplier={speedMultiplier}
        isWanted={isWanted}
      />
    </group>
  );
});
