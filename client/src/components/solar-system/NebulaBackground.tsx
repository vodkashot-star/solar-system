import { useMemo } from "react";
import * as THREE from "three";

function makeNebulaTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  const bandAngle = Math.PI * 0.3;
  const cx = size / 2;
  const cy = size / 2;
  const maxDist = size * 0.7;

  function hash(x: number, y: number, z: number) {
    let n = x * 374761393 + y * 668265263 + z * 1274126177;
    n = (n ^ (n >> 13)) * 1274126177;
    return (n ^ (n >> 15)) / 2147483647;
  }

  function smoothNoise(x: number, y: number, z: number) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fy = y - iy;
    const fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const sz = fz * fz * (3 - 2 * fz);
    let v = 0;
    for (let dx = 0; dx < 2; dx++)
      for (let dy = 0; dy < 2; dy++)
        for (let dz = 0; dz < 2; dz++) {
          const w = (dx === 0 ? 1 - sx : sx) * (dy === 0 ? 1 - sy : sy) * (dz === 0 ? 1 - sz : sz);
          v += w * hash(ix + dx, iy + dy, iz + dz);
        }
    return v;
  }

  function fbm(x: number, y: number, octaves = 4) {
    let v = 0;
    let amp = 1;
    let freq = 1;
    let totalAmp = 0;
    for (let i = 0; i < octaves; i++) {
      v += amp * smoothNoise(x * freq, y * freq, 0.5);
      totalAmp += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return v / totalAmp;
  }

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const i = (py * size + px) * 4;

      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const nx = dx / size;
      const ny = dy / size;

      const bandY = nx * Math.cos(bandAngle) + ny * Math.sin(bandAngle);
      const bandX = -nx * Math.sin(bandAngle) + ny * Math.cos(bandAngle);

      const bandDist = Math.abs(bandY) * 3.5;
      let density = Math.exp(-bandDist * bandDist * 1.2);

      const warp = fbm(bandX * 4 + 0.5, bandY * 4 + 0.5, 3) * 0.4;
      density += Math.exp(-(bandDist + warp) * (bandDist + warp) * 1.5) * 0.3;

      const noiseVal = fbm(nx * 3 + 1.2, ny * 3 + 0.8, 2);
      density += noiseVal * 0.1;

      const falloff = 1 - Math.min(dist / maxDist, 1);
      density *= falloff * falloff * 0.6;

      density = Math.max(0, Math.min(1, density));

      const dust = fbm(nx * 8 + 3.7, ny * 8 + 1.3, 3);
      const darkPatch = 1 - dust * 0.15;

      const r = density * 0.25 * darkPatch;
      const g = density * 0.15 * darkPatch;
      const b = density * 0.45 * darkPatch;

      data[i] = Math.round(Math.min(255, r * 255));
      data[i + 1] = Math.round(Math.min(255, g * 255));
      data[i + 2] = Math.round(Math.min(255, b * 255));
      data[i + 3] = Math.round(Math.min(255, density * 255 * 0.35));
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// Texture is expensive (~10M ops at 512px) — generate once per session and
// share across every band layer that mounts.
let cachedTexture: THREE.CanvasTexture | null = null;
function getNebulaTexture(): THREE.CanvasTexture {
  if (!cachedTexture) cachedTexture = makeNebulaTexture();
  return cachedTexture;
}

type NebulaBackgroundProps = {
  /** Mesh rotation — rotate the band across the sky. */
  rotation?: [number, number, number];
  /** Material opacity (primary band 0.5, depth bands lower). */
  opacity?: number;
  /** Sphere radius — larger = further away. */
  radius?: number;
};

export default function NebulaBackground({
  rotation,
  opacity = 0.5,
  radius = 380,
}: NebulaBackgroundProps) {
  const texture = useMemo(getNebulaTexture, []);

  return (
    <mesh rotation={rotation}>
      <sphereGeometry args={[radius, 64, 32]} />
      <meshBasicMaterial
        map={texture}
        side={THREE.BackSide}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
