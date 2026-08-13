import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { damp3 } from "maath/easing";
import { BODIES, type Body } from "./bodies";
import { useCameraFocus } from "@/stores/camera-focus";

type Props = {
  enabled: boolean;
  onActiveChange?: (body: Body) => void;
  onOverviewChange?: (active: boolean) => void;
  positions: React.MutableRefObject<Record<string, THREE.Vector3>>;
  computedRadii: React.MutableRefObject<Record<string, number>>;
  speedMultiplier?: number;
  /** Bodies to tour (defaults to the static catalog). */
  bodies?: Body[];
};

const OVERVIEW_DURATION = 10;
const SECONDS_PER_BODY = 5;

export default function CinematicTour({ enabled, onActiveChange, onOverviewChange, positions, computedRadii, speedMultiplier = 1, bodies = BODIES }: Props) {
  const { camera, invalidate } = useThree();
  const elapsed = useRef(0);
  const currentIndex = useRef(-1);
  const overviewDone = useRef(false);
  const overviewNotified = useRef(false);
  const targetPos = useRef(new THREE.Vector3(0, 8, 30));
  const lookAt = useRef(new THREE.Vector3(0, 0, 0));
  const currentLook = useRef(new THREE.Vector3(0, 0, 0));
  // Eased copy of targetPos — segment-to-segment target jumps are smoothed here
  // first so the camera glides between bodies instead of whipping after each cut.
  const smoothedTarget = useRef(new THREE.Vector3());
  const wasEnabled = useRef(false);
  const isFocused = useCameraFocus((s) => s.isFocused);
  const fitAll = useCameraFocus((s) => s.fitAll);

  useEffect(() => {
    if (enabled) {
      overviewNotified.current = false;
    } else {
      wasEnabled.current = false;
    }
  }, [enabled]);

  useFrame((_, delta) => {
    if (!enabled || isFocused || fitAll) return;

    if (!wasEnabled.current) {
      // Re-entry (mount or resume): start the eased target from the camera's
      // current position so resuming the tour never yanks the camera.
      smoothedTarget.current.copy(camera.position);
      wasEnabled.current = true;
    }

    const scaledDelta = delta * speedMultiplier;
    elapsed.current += scaledDelta;

    if (!overviewDone.current) {
      if (!overviewNotified.current) {
        overviewNotified.current = true;
        onOverviewChange?.(true);
      }

      // Frame the whole system once, at a fixed distance that clears the
      // outermost orbit (previously the radius shrank below Sedna's orbit,
      // sweeping the camera through the orbit lines — messy).
      const maxOrbit = bodies.reduce((m, b) => (b.orbit > m ? b.orbit : m), 40);
      const t = Math.min(elapsed.current / OVERVIEW_DURATION, 1);
      const angle = t * Math.PI * 2;
      const dist = maxOrbit * 1.9;
      const height = maxOrbit * 0.8;

      targetPos.current.set(
        Math.cos(angle) * dist,
        height,
        Math.sin(angle) * dist,
      );
      lookAt.current.set(0, 0, 0);

      if (t >= 1) {
        overviewDone.current = true;
        onOverviewChange?.(false);
        elapsed.current = 0;
      }
    } else {
      const idx = Math.floor(elapsed.current / SECONDS_PER_BODY) % bodies.length;
      if (idx !== currentIndex.current) {
        currentIndex.current = idx;
        onActiveChange?.(bodies[idx]);
      }

      const body = bodies[idx];
      const localT = (elapsed.current % SECONDS_PER_BODY) / SECONDS_PER_BODY;

      const bodyPos = positions.current[body.id];
      if (bodyPos) {
        const frameR = computedRadii.current[body.id] ?? body.visualRadius;

        // Continuous arc angle (monotonic across segments) — the old per-segment
        // reset jumped the target 216° around each body, snapping the camera.
        const arcAngle = (idx + localT) * Math.PI * 1.2;
        const dist = frameR * 6 + 5;
        const height = frameR * 0.9 + 2.0;

        targetPos.current.set(
          bodyPos.x + Math.cos(arcAngle) * dist,
          bodyPos.y + height,
          bodyPos.z + Math.sin(arcAngle) * dist,
        );
        lookAt.current.copy(bodyPos);
      }
      // No live position yet (body not mounted): hold the previous target so
      // the camera hovers in place instead of diving to the origin.
    }

    // Ease the raw target so hard segment cuts become bounded glide paths,
    // then settle the camera on it faster so it rests between bodies.
    smoothedTarget.current.lerp(targetPos.current, 1 - Math.exp(-2.5 * delta));
    damp3(camera.position, smoothedTarget.current, 1.3 * Math.min(speedMultiplier, 1), scaledDelta);
    damp3(currentLook.current, lookAt.current, 1.1 * Math.min(speedMultiplier, 1), scaledDelta);
    camera.lookAt(currentLook.current);

    invalidate();
  });

  return null;
}
