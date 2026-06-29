import { useMemo } from "react";
import * as THREE from "three";
import { BODIES, BODY_TYPE_COLORS } from "./bodies";

const SEGMENTS = 128;

type Props = { scaleMultiplier?: number };

export default function OrbitRings({ scaleMultiplier = 1 }: Props) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color();

    for (const body of BODIES) {
      if (body.orbit <= 0) continue;
      const radius = body.orbit * scaleMultiplier;
      const hex = BODY_TYPE_COLORS[body.type] ?? "#ffffff";
      color.set(hex);

      for (let i = 0; i < SEGMENTS; i++) {
        const a = (i / SEGMENTS) * Math.PI * 2;
        const b = ((i + 1) / SEGMENTS) * Math.PI * 2;
        positions.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
        positions.push(Math.cos(b) * radius, 0, Math.sin(b) * radius);
        colors.push(color.r, color.g, color.b);
        colors.push(color.r, color.g, color.b);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, [scaleMultiplier]);

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent opacity={0.12} linewidth={1} />
    </lineSegments>
  );
}
