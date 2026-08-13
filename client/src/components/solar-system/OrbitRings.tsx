import { useMemo, useRef, useLayoutEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { LineSegments2, LineSegmentsGeometry, LineMaterial } from "three-stdlib";
import { BODIES, type Body, BODY_TYPE_COLORS } from "./bodies";
import { getHeliocentricPosition, ASTRONOMY_BODIES, SIM_SPEED } from "@/lib/astronomy-positions";
import { solveKeplerElliptic } from "@/lib/kepler";
import { useCinematicMode } from "@/stores/cinematic-mode";
import { useSimulation } from "@/stores/simulation";

const SEGMENTS = 128;

type Props = {
  scaleMultiplier?: number;
  bodies?: Body[];
  dimmed?: boolean;
  /** Body whose orbit gets a bright highlight pass (tour/focus target). */
  activeId?: string | null;
};

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

function sampleEphemerisPoints(bodyId: string, orbitalPeriod: number, orbitRadius: number, segments: number): number[] {
  if (orbitalPeriod <= 0) return [];
  const pts: number[] = [];
  const periodSec = orbitalPeriod / SIM_SPEED;
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * periodSec;
    const pos = getHeliocentricPosition(bodyId, t, 1, orbitRadius);
    if (pos) {
      pts.push(pos.x, pos.y, pos.z);
    }
  }
  return pts;
}

/** Sampled polyline for one body (flat xyz), used by both passes. */
function sampleOrbit(body: Body): number[] {
  return ASTRONOMY_BODIES.has(body.id)
    ? sampleEphemerisPoints(body.id, body.properties.orbitalPeriod, body.orbit, SEGMENTS)
    : sampleOrbitPoints(body.orbit, body.properties.eccentricity, body.properties.inclination * Math.PI / 180, SEGMENTS);
}

/** Convert a flat polyline into flat segment pairs (6 numbers per segment). */
function toSegments(pts: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < pts.length / 3 - 1; i++) {
    const i3 = i * 3;
    for (const offset of [0, 3]) {
      out.push(pts[i3 + offset], pts[i3 + offset + 1], pts[i3 + offset + 2]);
    }
  }
  return out;
}

export default function OrbitRings({ scaleMultiplier = 1, bodies = BODIES, dimmed = false, activeId = null }: Props) {
  const { size } = useThree();
  const cinematic = useCinematicMode((s) => s.enabled);
  const speed = useSimulation((s) => s.speed);
  const activeMatRef = useRef<LineMaterial | null>(null);

  const { geometry, activeGeometry, activeColor } = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color();
    let activePts: number[] | null = null;
    let activeHex: string | null = null;

    for (const body of bodies) {
      if (body.orbit <= 0) continue;
      if (body.parentBody) continue;

      const hex = BODY_TYPE_COLORS[body.type] ?? "#ffffff";
      color.set(hex);

      const pts = sampleOrbit(body);
      if (body.id === activeId) {
        activePts = pts;
        activeHex = hex;
      }

      for (let i = 0; i < pts.length / 3 - 1; i++) {
        const i3 = i * 3;
        for (const offset of [0, 3]) {
          positions.push(pts[i3 + offset], pts[i3 + offset + 1], pts[i3 + offset + 2]);
          colors.push(color.r, color.g, color.b);
        }
      }
    }

    const geo = new LineSegmentsGeometry();
    geo.setPositions(positions);
    geo.setColors(colors);

    let activeGeo: LineSegmentsGeometry | null = null;
    if (activePts && activePts.length >= 6) {
      const segs = toSegments(activePts);
      activeGeo = new LineSegmentsGeometry();
      activeGeo.setPositions(segs);
    }

    return { geometry: geo, activeGeometry: activeGeo, activeColor: activeHex };
  }, [bodies, activeId]);

  // Highlight dash slowly scrolls while the simulation/tour runs; frozen when
  // paused (matches the scene-wide pause-freeze pattern).
  useFrame(({ clock, invalidate }) => {
    if (activeMatRef.current) {
      activeMatRef.current.dashOffset = -clock.elapsedTime * 0.4;
    }
    if (speed > 0 || cinematic) {
      invalidate();
    }
  });

  // LineMaterial requires a pixel-space resolution uniform; keep it in sync
  // with the canvas size (updates on resize, no per-frame cost).
  const baseMat = useMemo(
    () =>
      new LineMaterial({
        vertexColors: true,
        linewidth: dimmed ? 1 : 1.5,
        transparent: true,
        opacity: dimmed ? 0.07 : 0.22,
        depthWrite: false,
      }),
    [dimmed],
  );
  const activeMat = useMemo(() => {
    if (!activeGeometry) return null;
    return new LineMaterial({
      color: new THREE.Color(activeColor ?? "#ffffff").getHex(),
      dashed: true,
      dashSize: 0.6,
      gapSize: 0.4,
      linewidth: 3,
      transparent: true,
      opacity: dimmed ? 0.15 : 0.55,
      depthWrite: false,
    });
  }, [activeGeometry, activeColor, dimmed]);

  useLayoutEffect(() => {
    baseMat.resolution.set(size.width, size.height);
    if (activeMat) {
      activeMat.resolution.set(size.width, size.height);
      activeMatRef.current = activeMat;
    }
  }, [baseMat, activeMat, size]);

  // three-stdlib line classes aren't React-typed → construct instances and
  // mount via primitive (same pattern as any raw THREE object).
  const baseLine = useMemo(() => new LineSegments2(geometry, baseMat), [geometry, baseMat]);
  const activeLine = useMemo(
    () => (activeGeometry && activeMat ? new LineSegments2(activeGeometry, activeMat) : null),
    [activeGeometry, activeMat],
  );

  return (
    <group scale={scaleMultiplier}>
      <primitive object={baseLine} />
      {activeLine && <primitive object={activeLine} />}
    </group>
  );
}