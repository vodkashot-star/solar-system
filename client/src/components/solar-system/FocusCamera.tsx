import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { damp3 } from "maath/easing";
import * as THREE from "three";
import { useCameraFocus } from "@/stores/camera-focus";
import { BODIES } from "./bodies";

type Props = {
  computedRadii: React.MutableRefObject<Record<string, number>>;
};

export default function FocusCamera({ computedRadii }: Props) {
  const { camera, invalidate } = useThree();
  const { isFocused, targetBodyId, targetPosition, clear } = useCameraFocus();
  const lookTarget = useRef(new THREE.Vector3());
  const flyTarget = useRef(new THREE.Vector3(0, 12, 38));
  const lookCurrent = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (isFocused && targetBodyId) {
      const body = BODIES.find((b) => b.id === targetBodyId);
      if (body) {
        const bodyPos = targetPosition;
        const frameR = computedRadii.current[body.id] ?? body.visualRadius;
        const dist = frameR * 5 + 5;
        const height = frameR * 0.8 + 2;
        flyTarget.current.set(bodyPos.x + dist, bodyPos.y + height, bodyPos.z + dist);
        lookTarget.current.copy(bodyPos);
      }
    }
  }, [isFocused, targetBodyId, targetPosition, computedRadii]);

  useFrame((_, delta) => {
    if (!isFocused || !targetBodyId) return;

    damp3(camera.position, flyTarget.current, 0.85, delta);
    damp3(lookCurrent.current, lookTarget.current, 0.85, delta);
    camera.lookAt(lookCurrent.current);
    invalidate();
  });

  return null;
}
