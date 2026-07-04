import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { damp3 } from "maath/easing";
import * as THREE from "three";
import { useCameraFocus } from "@/stores/camera-focus";
import { BODIES } from "./bodies";

type Props = {
  positions: React.MutableRefObject<Record<string, THREE.Vector3>>;
  computedRadii: React.MutableRefObject<Record<string, number>>;
};

export default function FocusCamera({ positions, computedRadii }: Props) {
  const { camera, invalidate } = useThree();
  const { isFocused, targetBodyId, clear } = useCameraFocus();
  const flyTarget = useRef(new THREE.Vector3(0, 12, 38));
  const lookCurrent = useRef(new THREE.Vector3(0, 0, 0));
  const lookTarget = useRef(new THREE.Vector3(0, 0, 0));
  // Track arrival so we can auto-clear focus after settling
  const settledFrames = useRef(0);

  useFrame((_, delta) => {
    if (!isFocused || !targetBodyId) return;

    // Read the planet's live position every frame — fixes stale snapshot bug
    const livePos = positions.current[targetBodyId];
    if (!livePos) return;

    const body = BODIES.find((b) => b.id === targetBodyId);
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
