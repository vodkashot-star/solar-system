import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { damp3 } from "maath/easing";
import * as THREE from "three";
import { useCameraFocus } from "@/stores/camera-focus";
import { BODIES, type Body } from "./bodies";

type Props = {
  positions: React.MutableRefObject<Record<string, THREE.Vector3>>;
  computedRadii: React.MutableRefObject<Record<string, number>>;
  bodies?: Body[];
};

const ORIGIN = new THREE.Vector3(0, 0, 0);

export default function FocusCamera({ positions, computedRadii, bodies = BODIES }: Props) {
  const { camera, invalidate } = useThree();
  const isFocused = useCameraFocus((s) => s.isFocused);
  const fitAll = useCameraFocus((s) => s.fitAll);
  const targetBodyId = useCameraFocus((s) => s.targetBodyId);
  const clear = useCameraFocus((s) => s.clear);
  const flyTarget = useRef(new THREE.Vector3(0, 12, 38));
  const lookCurrent = useRef(new THREE.Vector3(0, 0, 0));
  const lookTarget = useRef(new THREE.Vector3(0, 0, 0));
  // Track arrival so we can auto-clear focus after settling
  const settledFrames = useRef(0);

  // Fit-all: frame every body on screen. Distance comes from the live
  // positions + radii (bounding sphere around the origin), so custom bodies
  // and scale modes are honored automatically.
  const computeFit = () => {
    let maxR = 0;
    for (const id of Object.keys(positions.current)) {
      const p = positions.current[id];
      const r = computedRadii.current[id] ?? 1;
      const d = p.distanceTo(ORIGIN) + r;
      if (d > maxR) maxR = d;
    }
    // Fallback when no positions reported yet (first frames): use catalog orbits
    if (maxR === 0) {
      for (const b of bodies) {
        if (b.orbit > 0 && b.orbit > maxR) maxR = b.orbit;
      }
    }
    const dist = maxR * 2.4;
    const height = maxR * 0.75;
    flyTarget.current.set(0, height, dist);
    lookTarget.current.set(0, 0, 0);
  };

  useFrame((_, delta) => {
    if (fitAll) {
      computeFit();

      damp3(camera.position, flyTarget.current, 0.9, delta);
      damp3(lookCurrent.current, lookTarget.current, 0.9, delta);
      camera.lookAt(lookCurrent.current);
      invalidate();

      // Auto-clear once settled so OrbitControls resume
      const distToTarget = camera.position.distanceTo(flyTarget.current);
      if (distToTarget < 0.5) {
        settledFrames.current += 1;
        if (settledFrames.current > 20) {
          settledFrames.current = 0;
          clear();
        }
      } else {
        settledFrames.current = 0;
      }
      return;
    }

    if (!isFocused || !targetBodyId) return;

    // Read the planet's live position every frame — fixes stale snapshot bug
    const livePos = positions.current[targetBodyId];
    if (!livePos) return;

    const body = bodies.find((b) => b.id === targetBodyId);
    const frameR = computedRadii.current[targetBodyId] ?? body?.visualRadius ?? 1;
    const dist = frameR * 7 + 7;
    const height = frameR * 0.6 + 2.5;

    flyTarget.current.set(livePos.x + dist, livePos.y + height, livePos.z + dist);
    lookTarget.current.copy(livePos);

    damp3(camera.position, flyTarget.current, 0.85, delta);
    damp3(lookCurrent.current, lookTarget.current, 0.85, delta);
    camera.lookAt(lookCurrent.current);
    invalidate();

    // Auto-clear focus once camera has settled close enough
    const distToTarget = camera.position.distanceTo(flyTarget.current);
    if (distToTarget < 0.5) {
      settledFrames.current += 1;
      if (settledFrames.current > 30) {
        settledFrames.current = 0;
        clear();
      }
    } else {
      settledFrames.current = 0;
    }
  });

  return null;
}
