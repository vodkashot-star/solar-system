import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { damp3 } from "maath/easing";
import { BODIES, type Body } from "./bodies";
import { useCameraFocus } from "@/stores/camera-focus";

const FALLBACK_POS = new THREE.Vector3(0, 0, 0);

type Props = {
  enabled: boolean;
  onActiveChange?: (body: Body) => void;
  positions: React.MutableRefObject<Record<string, THREE.Vector3>>;
  computedRadii: React.MutableRefObject<Record<string, number>>;
};

const SECONDS_PER_BODY = 5;

export default function CinematicTour({ enabled, onActiveChange, positions, computedRadii }: Props) {
  const { camera, invalidate } = useThree();
  const elapsed = useRef(0);
  const currentIndex = useRef(-1);
  const targetPos = useRef(new THREE.Vector3(0, 8, 30));
  const lookAt = useRef(new THREE.Vector3(0, 0, 0));
  const currentLook = useRef(new THREE.Vector3(0, 0, 0));
  const isFocused = useCameraFocus((s) => s.isFocused);

  useFrame((_, delta) => {
    if (!enabled || isFocused) return;

    elapsed.current += delta;
    const idx = Math.floor(elapsed.current / SECONDS_PER_BODY) % BODIES.length;
    if (idx !== currentIndex.current) {
      currentIndex.current = idx;
      onActiveChange?.(BODIES[idx]);
    }

    const body = BODIES[idx];
    const localT = (elapsed.current % SECONDS_PER_BODY) / SECONDS_PER_BODY;

    const bodyPos = positions.current[body.id] ?? FALLBACK_POS;
    const frameR = computedRadii.current[body.id] ?? body.visualRadius;

    const arcAngle = localT * Math.PI * 1.2;
    const dist = frameR * 6 + 5;
    const height = frameR * 0.9 + 2.0;

    targetPos.current.set(
      bodyPos.x + Math.cos(arcAngle) * dist,
      bodyPos.y + height,
      bodyPos.z + Math.sin(arcAngle) * dist
    );

    lookAt.current.copy(bodyPos);

    damp3(camera.position, targetPos.current, 0.87, delta);
    damp3(currentLook.current, lookAt.current, 0.85, delta);
    camera.lookAt(currentLook.current);

    invalidate();
  });

  return null;
}
