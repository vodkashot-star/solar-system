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
      const a = body.orbit;
      const e = body.properties.eccentricity;
      const inclRad = body.properties.inclination * Math.PI / 180;
      const b = a * Math.sqrt(Math.max(0, 1 - e * e));
      const hex = BODY_TYPE_COLORS[body.type] ?? "#ffffff";
      color.set(hex);

      for (let i = 0; i < SEGMENTS; i++) {
        const t1 = (i / SEGMENTS) * Math.PI * 2;
        const t2 = ((i + 1) / SEGMENTS) * Math.PI * 2;
        for (const t of [t1, t2]) {
          const xOrb = a * Math.cos(t);
          const zOrb = b * Math.sin(t);
          const x = xOrb;
          const y = zOrb * Math.sin(inclRad);
          const z = zOrb * Math.cos(inclRad);
          positions.push(x, y, z);
          colors.push(color.r, color.g, color.b);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, []);

  return (
    <group scale={scaleMultiplier}>
      <lineSegments geometry={geometry} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent opacity={0.2} linewidth={1} />
      </lineSegments>
    </group>
  );
}
