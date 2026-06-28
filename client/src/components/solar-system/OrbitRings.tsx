import { useMemo, Fragment } from "react";
import * as THREE from "three";
import { BODIES, BODY_TYPE_COLORS, type BodyType } from "./bodies";

const SEGMENTS = 128;

type Props = {
  scaleMultiplier?: number;
};

function buildRingGeometry(bodies: typeof BODIES, scaleMultiplier: number) {
  const positions: number[] = [];
  for (const body of bodies) {
    const radius = body.orbit * scaleMultiplier;
    for (let i = 0; i < SEGMENTS; i++) {
      const thetaA = (i / SEGMENTS) * Math.PI * 2;
      const thetaB = ((i + 1) / SEGMENTS) * Math.PI * 2;
      positions.push(
        Math.cos(thetaA) * radius, 0, Math.sin(thetaA) * radius,
        Math.cos(thetaB) * radius, 0, Math.sin(thetaB) * radius,
      );
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

const CATEGORIES = Object.keys(BODY_TYPE_COLORS) as BodyType[];

export default function OrbitRings({ scaleMultiplier = 1 }: Props) {
  const rings = useMemo(() => {
    return CATEGORIES.map((type) => {
      const bodiesOfType = BODIES.filter((b) => b.orbit > 0 && b.type === type);
      if (bodiesOfType.length === 0) return null;
      return {
        type,
        geometry: buildRingGeometry(bodiesOfType, scaleMultiplier),
      };
    }).filter(Boolean);
  }, [scaleMultiplier]);

  return (
    <Fragment>
      {rings.map((ring) => {
        if (!ring) return null;
        const color = BODY_TYPE_COLORS[ring.type];
        return (
          <lineSegments key={ring.type} geometry={ring.geometry} frustumCulled={false}>
            <lineBasicMaterial
              color={color}
              opacity={0.1}
              transparent
              linewidth={1}
            />
          </lineSegments>
        );
      })}
    </Fragment>
  );
}
