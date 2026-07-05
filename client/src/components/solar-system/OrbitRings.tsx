import { useMemo } from "react";
import * as THREE from "three";
import { BODIES, BODY_TYPE_COLORS } from "./bodies";
import { getHeliocentricPosition, ASTRONOMY_BODIES, SIM_SPEED } from "@/lib/astronomy-positions";

const SEGMENTS = 128;

type Props = { scaleMultiplier?: number };

function solveKeplerElliptic(M: number, e: number): number {
  let E = M;
  for (let i = 0; i < 12; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-8) break;
  }
  return E;
}

function sampleOrbitPoints(a: number, e: number, inclRad: number, segments: number): number[] {
  const pts: number[] = [];
  if (e > 1) {
    const p = a * (e * e - 1);
    const thetaMax = Math.PI - Math.acos(1 / e) - 0.05;
    for (let i = 0; i <= segments; i++) {
      const theta = -thetaMax + (2 * thetaMax * i) / segments;
      const r = p / (1 + e * Math.cos(theta));
      const xOrb = r * Math.cos(theta);
      const zOrb = r * Math.sin(theta);
      const y = zOrb * Math.sin(inclRad);
      const z = zOrb * Math.cos(inclRad);
      pts.push(xOrb, y, z);
    }
  } else {
    const b = a * Math.sqrt(Math.max(0, 1 - e * e));
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      const E = e < 1e-6 ? t : solveKeplerElliptic(t, e);
      const xOrb = a * (Math.cos(E) - e);
      const zOrb = b * Math.sin(E);
      const y = zOrb * Math.sin(inclRad);
      const z = zOrb * Math.cos(inclRad);
      pts.push(xOrb, y, z);
    }
  }
  return pts;
}

function sampleEphemerisPoints(bodyId: string, orbitalPeriod: number, segments: number): number[] {
  if (orbitalPeriod <= 0) return [];
  const pts: number[] = [];
  const periodSec = orbitalPeriod / SIM_SPEED;
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * periodSec;
    const pos = getHeliocentricPosition(bodyId, t, 1);
    if (pos) {
      pts.push(pos.x, pos.y, pos.z);
    }
  }
  return pts;
}

export default function OrbitRings({ scaleMultiplier = 1 }: Props) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color();

    for (const body of BODIES) {
      if (body.orbit <= 0) continue;
      if (body.parentBody) continue;

      const hex = BODY_TYPE_COLORS[body.type] ?? "#ffffff";
      color.set(hex);

      const pts = ASTRONOMY_BODIES.has(body.id)
        ? sampleEphemerisPoints(body.id, body.properties.orbitalPeriod, SEGMENTS)
        : sampleOrbitPoints(body.orbit, body.properties.eccentricity, body.properties.inclination * Math.PI / 180, SEGMENTS);

      for (let i = 0; i < pts.length / 3 - 1; i++) {
        const i3 = i * 3;
        for (const offset of [0, 3]) {
          positions.push(pts[i3 + offset], pts[i3 + offset + 1], pts[i3 + offset + 2]);
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
        <lineBasicMaterial vertexColors transparent opacity={0.2} linewidth={1} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </lineSegments>
    </group>
  );
}
