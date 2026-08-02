/**
 * RingSystem.tsx
 *
 * Renders planetary ring systems with astronomically accurate parameters.
 * Supports Saturn, Jupiter, Uranus, Neptune, and Haumea.
 *
 * Rings are a custom fan geometry with radial UVs (u = radius, v = azimuth)
 * textured by a per-body canvas texture — Saturn gets its classic banded
 * structure (C ring, bright B ring, Cassini division, A ring, Encke dip),
 * the others a soft banded gradient. The azimuthal texture axis fakes the
 * bright-side/dark-side illumination gradient.
 */

import { useMemo } from "react";
import * as THREE from "three";
import type { Body } from "./bodies";

interface RingParameters {
  innerRadius: number;   // Planet radii
  outerRadius: number;   // Planet radii
  inclination: number;   // Degrees, relative to planet equator
  opticalDepth: number;  // 0-1, affects opacity
  color: string;
  segments: number;
}

// [from, to, alpha] bands along the ring radius (0 = inner, 1 = outer).
// Alpha values are relative — scaled by maxOpacity below.
const SATURN_BANDS: Array<[number, number, number]> = [
  [0.00, 0.05, 0.0],
  [0.05, 0.34, 0.38],  // C ring (faint, broad)
  [0.34, 0.44, 0.55],  // inner B ring ramp
  [0.44, 0.62, 1.0],   // B ring core (brightest)
  [0.54, 0.57, 0.7],   // B ringlet trough
  [0.62, 0.66, 0.08],  // Cassini division
  [0.66, 0.90, 0.72],  // A ring
  [0.92, 0.95, 0.25],  // Encke dip
];

const GENERIC_BANDS: Array<[number, number, number]> = [
  [0.00, 0.06, 0.35],
  [0.06, 0.32, 0.8],
  [0.32, 0.5, 0.62],
  [0.5, 0.78, 0.85],
  [0.78, 1.0, 0.45],
];

const RING_PARAMETERS: Record<string, RingParameters> = {
  saturn: {
    innerRadius: 1.24,
    outerRadius: 2.27,
    inclination: 26.7,
    opticalDepth: 0.8,
    color: "#c8b88a",
    segments: 128,
  },
  jupiter: {
    innerRadius: 1.72,
    outerRadius: 1.81,
    inclination: 3.1,
    opticalDepth: 0.01,
    color: "#8b7d6b",
    segments: 64,
  },
  uranus: {
    innerRadius: 1.59,
    outerRadius: 2.00,
    inclination: 97.8,
    opticalDepth: 0.1,
    color: "#7a7a7a",
    segments: 64,
  },
  neptune: {
    innerRadius: 1.72,
    outerRadius: 2.54,
    inclination: 28.3,
    opticalDepth: 0.05,
    color: "#5a5a7a",
    segments: 64,
  },
  haumea: {
    innerRadius: 1.4,
    outerRadius: 1.8,
    inclination: 0,
    opticalDepth: 0.3,
    color: "#a0a0b0",
    segments: 32,
  },
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return { r: 200, g: 184, b: 138 };
  return { r, g, b };
}

/**
 * Fan geometry with radial UVs: uv.x runs inner→outer across the ring,
 * uv.y runs around the ring (0 = +X axis, going CCW). This lets a 1-D
 * canvas texture encode radial banding exactly.
 */
function createRingGeometry(
  params: RingParameters,
  planetRadius: number,
  radialSegments = 4,
): THREE.BufferGeometry {
  const inner = planetRadius * params.innerRadius;
  const outer = planetRadius * params.outerRadius;
  const segments = params.segments;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let s = 0; s <= segments; s++) {
    const theta = (s / segments) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    for (let r = 0; r <= radialSegments; r++) {
      const radius = inner + (outer - inner) * (r / radialSegments);
      positions.push(cos * radius, sin * radius, 0);
      uvs.push(r / radialSegments, s / segments);
    }
  }

  for (let s = 0; s < segments; s++) {
    for (let r = 0; r < radialSegments; r++) {
      const a = s * (radialSegments + 1) + r;
      const b = a + radialSegments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeRingTexture(params: RingParameters, bodyId: string): THREE.CanvasTexture {
  const W = 256;
  const H = 8;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(W, H);
  const data = imageData.data;

  const { r, g, b } = hexToRgb(params.color);
  const bands = bodyId === "saturn" ? SATURN_BANDS : GENERIC_BANDS;
  const maxOpacity = Math.min(params.opticalDepth * 1.2, 0.85);

  for (let x = 0; x < W; x++) {
    const u = x / (W - 1);

    let alpha = 0;
    for (const [from, to, a] of bands) {
      if (u >= from && u <= to && a > alpha) alpha = a;
    }
    alpha *= maxOpacity;

    // Soft falloff at the inner and outer edges.
    const edge = Math.min(1, u / 0.04, (1 - u) / 0.04);
    alpha *= Math.max(0, Math.min(1, edge));

    for (let y = 0; y < H; y++) {
      // Fake illumination: one side of the ring reads brighter, the other dimmer.
      const v = y / (H - 1);
      const illumination = 0.85 + 0.15 * v;
      const a = Math.min(1, alpha * illumination);
      const idx = (y * W + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = Math.round(a * 255);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

interface RingSystemProps {
  body: Body;
  planetRadius: number;
}

export default function RingSystem({ body, planetRadius }: RingSystemProps) {
  const ringParams = RING_PARAMETERS[body.id];

  if (!ringParams) return null;

  const geometry = useMemo(
    () => createRingGeometry(ringParams, planetRadius),
    [body.id, planetRadius],
  );

  const texture = useMemo(() => makeRingTexture(ringParams, body.id), [body.id]);

  // Rendered inside Planet's spin group, which already applies body.tilt,
  // so the ring plane lies flat relative to the tilted equator.
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      geometry={geometry}
      frustumCulled={false}
      onClick={(e) => e.stopPropagation()}
      onPointerOver={(e) => e.stopPropagation()}
      onPointerOut={(e) => e.stopPropagation()}
    >
      <meshBasicMaterial
        map={texture}
        side={THREE.DoubleSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

export { RING_PARAMETERS, type RingParameters };
