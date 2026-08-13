import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { makeGlowTexture } from "@/lib/glow-textures";
import { useCinematicMode } from "@/stores/cinematic-mode";

export default function SunGlow() {
  const glowRef = useRef<THREE.Sprite>(null);
  const coronaRef = useRef<THREE.Sprite>(null);
  const raysRef = useRef<THREE.Sprite>(null);
  const cinematic = useCinematicMode((s) => s.enabled);

  const glowTex = useMemo(
    () =>
      makeGlowTexture(256, [
        [0, "rgba(255, 220, 140, 1)"],
        [0.1, "rgba(255, 180, 80, 0.9)"],
        [0.3, "rgba(255, 120, 40, 0.5)"],
        [0.5, "rgba(255, 80, 20, 0.2)"],
        [0.7, "rgba(200, 50, 10, 0.08)"],
        [1, "rgba(0, 0, 0, 0)"],
      ]),
    [],
  );
  const coronaTex = useMemo(
    () =>
      makeGlowTexture(512, [
        [0, "rgba(255, 255, 255, 0)"],
        [0.02, "rgba(255, 200, 100, 0.3)"],
        [0.15, "rgba(255, 160, 60, 0.15)"],
        [0.4, "rgba(255, 100, 30, 0.06)"],
        [0.7, "rgba(200, 50, 10, 0.02)"],
        [1, "rgba(0, 0, 0, 0)"],
      ]),
    [],
  );
  const raysTex = useMemo(
    () =>
      makeGlowTexture(256, [
        [0, "rgba(255, 240, 200, 0.35)"],
        [0.06, "rgba(255, 220, 150, 0.22)"],
        [0.2, "rgba(255, 180, 100, 0.08)"],
        [0.5, "rgba(255, 140, 70, 0.02)"],
        [1, "rgba(0, 0, 0, 0)"],
      ]),
    [],
  );

  useFrame(({ clock, invalidate }) => {
    if (coronaRef.current) {
      const pulse = 1 + 0.04 * Math.sin(clock.elapsedTime * 0.8);
      coronaRef.current.scale.setScalar(70 * pulse);
      coronaRef.current.material.opacity = 0.35 + 0.08 * Math.sin(clock.elapsedTime * 0.6);
    }
    if (glowRef.current) {
      const pulse = 1 + 0.02 * Math.sin(clock.elapsedTime * 1.1);
      glowRef.current.scale.setScalar(25 * pulse);
    }
    // God rays — slow tilt while the tour film plays.
    if (raysRef.current) {
      const wobble = 0.1 * Math.sin(clock.elapsedTime * 0.14);
      raysRef.current.rotation.z = -0.28 + wobble;
      raysRef.current.material.opacity = 0.16 + 0.04 * Math.sin(clock.elapsedTime * 0.9);
    }
    invalidate();
  });

  return (
    <>
      <sprite ref={coronaRef} scale={[70, 70, 1]} position={[0, 0, 0]}>
        <spriteMaterial
          map={coronaTex}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
          opacity={0.35}
        />
      </sprite>
      <sprite ref={glowRef} scale={[25, 25, 1]} position={[0, 0, 0]}>
        <spriteMaterial
          map={glowTex}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
          opacity={0.9}
        />
      </sprite>
      {/* Subtle vertical light shafts, billboarded — tour-only so the
          overview frames read as a golden film still. */}
      {cinematic && (
        <sprite ref={raysRef} scale={[11, 52, 1]} position={[0, 0, 0]}>
          <spriteMaterial
            map={raysTex}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            transparent
            opacity={0.16}
          />
        </sprite>
      )}
    </>
  );
}
