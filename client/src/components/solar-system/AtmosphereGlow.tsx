import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { hexToRgba, makeGlowTexture } from "@/lib/glow-textures";
import { useCinematicMode } from "@/stores/cinematic-mode";
import { useSimulation } from "@/stores/simulation";

const ATMOSPHERE_COLORS: Record<string, string> = {
  earth: "#4fc3f7",
  venus: "#ffcc80",
  mars: "#ef9a9a",
  jupiter: "#d2a679",
  saturn: "#e8d8a0",
  neptune: "#5b9bd5",
};

type Props = {
  radius: number;
  bodyId: string;
};

export default function AtmosphereGlow({ radius, bodyId }: Props) {
  const ref = useRef<THREE.Sprite>(null);
  const cinematic = useCinematicMode((s) => s.enabled);
  const speed = useSimulation((s) => s.speed);
  const color = ATMOSPHERE_COLORS[bodyId] ?? "#ffffff";
  const tex = useMemo(
    () =>
      makeGlowTexture(128, [
        [0, "rgba(0,0,0,0)"],
        [0.1, hexToRgba(color, 0.4)],
        [0.5, hexToRgba(color, 0.12)],
        [1, "rgba(0,0,0,0)"],
      ]),
    [color],
  );

  useFrame(({ clock, invalidate }) => {
    if (ref.current) {
      const pulse = 1 + 0.02 * Math.sin(clock.elapsedTime * 0.5 + bodyId.charCodeAt(0));
      ref.current.scale.setScalar(radius * 3.2 * pulse);
    }
    // Paused (speed 0, no tour) → planets don't invalidate either; freeze.
    if (speed > 0 || cinematic) {
      invalidate();
    }
  });

  return (
    <sprite ref={ref} scale={[radius * 3.2, radius * 3.2, 1]}>
      <spriteMaterial
        map={tex}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent
        opacity={0.5}
      />
    </sprite>
  );
}
