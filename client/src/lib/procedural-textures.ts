import * as THREE from "three";

const TEX_SIZE = 1024;

function noise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) / 2147483647;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function fbm(x: number, y: number, octaves: number): number {
  let value = 0;
  let amp = 1;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * noise2D(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return value;
}

function smoothNoise(x: number, y: number, octaves: number): number {
  return (fbm(x, y, octaves) + 1) / 2;
}

function voronoi(x: number, y: number, cells: number): number {
  const cx = x * cells;
  const cy = y * cells;
  const ix = Math.floor(cx);
  const iy = Math.floor(cy);
  const fx = cx - ix;
  const fy = cy - iy;
  let minDist = 2;
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      const nx = ix + ox + (hash(ix + ox, iy + oy) - 0.5);
      const ny = iy + oy + (hash(ix + ox + 7, iy + oy + 13) - 0.5);
      const dx = fx - (nx - ix);
      const dy = fy - (ny - iy);
      const d = dx * dx + dy * dy;
      if (d < minDist) minDist = d;
    }
  }
  return Math.sqrt(minDist) / 0.7;
}

function craterNoise(x: number, y: number): number {
  let val = 0;
  for (let size = 0.02; size < 0.3; size *= 2.2) {
    const v = voronoi(x, y, 1 / size);
    const crater = Math.max(0, 1 - v * 3) * size * 20;
    val += crater;
  }
  return Math.min(1, val);
}

type NoiseLayer = {
  scale: number;
  amplitude: number;
  octaves: number;
};

type PlanetTextureDef = {
  baseColor: [number, number, number][];
  noiseLayers: NoiseLayer[];
  useVoronoi?: boolean;
  voronoiCells?: number;
  banded?: boolean;
  bandCount?: number;
  bandVariation?: number;
  emissive?: boolean;
  emissiveColor?: [number, number, number];
};

const TEXTURE_DEFS: Record<string, PlanetTextureDef> = {
  sun: {
    baseColor: [[1, 0.6, 0.1], [1, 0.8, 0.2], [1, 0.4, 0.05]],
    noiseLayers: [
      { scale: 2, amplitude: 0.4, octaves: 6 },
      { scale: 8, amplitude: 0.3, octaves: 4 },
    ],
    emissive: true,
    emissiveColor: [1, 0.5, 0.1],
  },
  mercury: {
    baseColor: [[0.66, 0.64, 0.62], [0.59, 0.57, 0.55], [0.7, 0.68, 0.65]],
    noiseLayers: [
      { scale: 3, amplitude: 0.3, octaves: 5 },
      { scale: 10, amplitude: 0.15, octaves: 3 },
    ],
    useVoronoi: true,
    voronoiCells: 80,
  },
  venus: {
    baseColor: [[0.88, 0.75, 0.59], [0.92, 0.8, 0.6], [0.85, 0.7, 0.55]],
    noiseLayers: [
      { scale: 1.5, amplitude: 0.25, octaves: 4 },
      { scale: 6, amplitude: 0.2, octaves: 3 },
    ],
    banded: true,
    bandCount: 14,
    bandVariation: 0.3,
  },
  earth: {
    baseColor: [[0.2, 0.5, 0.8], [0.15, 0.45, 0.7], [0.3, 0.55, 0.85]],
    noiseLayers: [
      { scale: 2, amplitude: 0.3, octaves: 5 },
      { scale: 8, amplitude: 0.15, octaves: 3 },
    ],
    banded: true,
    bandCount: 8,
    bandVariation: 0.15,
  },
  mars: {
    baseColor: [[0.76, 0.27, 0.05], [0.7, 0.22, 0.04], [0.82, 0.32, 0.08]],
    noiseLayers: [
      { scale: 2.5, amplitude: 0.3, octaves: 5 },
      { scale: 9, amplitude: 0.15, octaves: 3 },
    ],
    useVoronoi: true,
    voronoiCells: 60,
  },
  jupiter: {
    baseColor: [[0.82, 0.65, 0.4], [0.9, 0.75, 0.5], [0.75, 0.55, 0.3]],
    noiseLayers: [
      { scale: 1.2, amplitude: 0.15, octaves: 3 },
    ],
    banded: true,
    bandCount: 24,
    bandVariation: 0.4,
  },
  saturn: {
    baseColor: [[0.91, 0.85, 0.63], [0.85, 0.78, 0.55], [0.78, 0.7, 0.48]],
    noiseLayers: [
      { scale: 1.2, amplitude: 0.1, octaves: 3 },
    ],
    banded: true,
    bandCount: 20,
    bandVariation: 0.35,
  },
  uranus: {
    baseColor: [[0.62, 0.85, 0.9], [0.55, 0.78, 0.85], [0.68, 0.88, 0.92]],
    noiseLayers: [
      { scale: 1.5, amplitude: 0.08, octaves: 2 },
    ],
    banded: true,
    bandCount: 16,
    bandVariation: 0.15,
  },
  neptune: {
    baseColor: [[0.23, 0.43, 0.82], [0.18, 0.38, 0.75], [0.28, 0.48, 0.88]],
    noiseLayers: [
      { scale: 1.5, amplitude: 0.1, octaves: 3 },
    ],
    banded: true,
    bandCount: 18,
    bandVariation: 0.2,
  },
};

const DWARF_DEF: PlanetTextureDef = {
  baseColor: [[0.7, 0.68, 0.68], [0.65, 0.62, 0.62], [0.75, 0.72, 0.7]],
  noiseLayers: [
    { scale: 2, amplitude: 0.25, octaves: 4 },
    { scale: 7, amplitude: 0.12, octaves: 3 },
  ],
  useVoronoi: true,
  voronoiCells: 50,
};

const ASTEROID_DEF: PlanetTextureDef = {
  baseColor: [[0.55, 0.5, 0.45], [0.5, 0.45, 0.4], [0.6, 0.55, 0.5]],
  noiseLayers: [
    { scale: 3, amplitude: 0.3, octaves: 5 },
    { scale: 12, amplitude: 0.2, octaves: 3 },
  ],
  useVoronoi: true,
  voronoiCells: 100,
};

const COMET_DEF: PlanetTextureDef = {
  baseColor: [[0.3, 0.28, 0.22], [0.35, 0.32, 0.25], [0.25, 0.22, 0.18]],
  noiseLayers: [
    { scale: 3, amplitude: 0.2, octaves: 4 },
    { scale: 9, amplitude: 0.15, octaves: 3 },
  ],
  useVoronoi: true,
  voronoiCells: 40,
};

function getDef(bodyId: string): PlanetTextureDef {
  if (TEXTURE_DEFS[bodyId]) return TEXTURE_DEFS[bodyId];
  const typeMap: Record<string, PlanetTextureDef> = {
    star: TEXTURE_DEFS.sun,
    planet: TEXTURE_DEFS.earth,
    dwarfPlanet: DWARF_DEF,
    asteroid: ASTEROID_DEF,
    comet: COMET_DEF,
    interstellar: ASTEROID_DEF,
  };
  return typeMap.dwarfPlanet;
}

function uvSphereProject(u: number, v: number): { x: number; y: number; z: number } {
  const theta = u * Math.PI * 2;
  const phi = v * Math.PI;
  return {
    x: Math.sin(phi) * Math.cos(theta),
    y: Math.sin(phi) * Math.sin(theta),
    z: Math.cos(phi),
  };
}

export function generateDiffuseMap(bodyId: string, type: string): THREE.CanvasTexture {
  const def = TEXTURE_DEFS[bodyId] ?? getDef(bodyId);
  const canvas = document.createElement("canvas");
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE / 2;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(canvas.width, canvas.height);
  const data = imageData.data;

  for (let py = 0; py < canvas.height; py++) {
    for (let px = 0; px < canvas.width; px++) {
      const u = px / canvas.width;
      const v = py / canvas.height;
      const p3 = uvSphereProject(u, v);
      const idx = (py * canvas.width + px) * 4;

      let noiseVal = 0;
      for (const layer of def.noiseLayers) {
        const nx = p3.x * layer.scale;
        const ny = p3.y * layer.scale;
        const nz = p3.z * layer.scale;
        const n = smoothNoise(nx + nz * 0.5, ny + nz * 0.3, layer.octaves);
        noiseVal += n * layer.amplitude;
      }
      noiseVal = Math.min(1, noiseVal);

      let bandVal = 0;
      if (def.banded) {
        const bc = def.bandCount ?? 10;
        const bv = def.bandVariation ?? 0.2;
        const raw = Math.sin(((v + noiseVal * bv) * bc + p3.x * 0.3) * Math.PI);
        bandVal = raw * 0.5 + 0.5;
      }

      let voronoiVal = 0;
      if (def.useVoronoi) {
        voronoiVal = craterNoise(p3.x * 0.5 + 0.5, p3.y * 0.5 + 0.5);
      }

      const blend = bandVal > 0 ? bandVal : noiseVal;
      const finalNoise = blend * 0.6 + voronoiVal * 0.4;

      const colors = def.baseColor;
      const ci = Math.floor(finalNoise * (colors.length - 1));
      const cf = finalNoise * (colors.length - 1) - ci;
      const c1 = colors[Math.min(ci, colors.length - 1)];
      const c2 = colors[Math.min(ci + 1, colors.length - 1)];

      data[idx] = Math.round((c1[0] + (c2[0] - c1[0]) * cf) * 255);
      data[idx + 1] = Math.round((c1[1] + (c2[1] - c1[1]) * cf) * 255);
      data[idx + 2] = Math.round((c1[2] + (c2[2] - c1[2]) * cf) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function generateNormalMap(bodyId: string, type: string): THREE.CanvasTexture {
  const diffuse = generateDiffuseMap(bodyId, type);
  const canvas = document.createElement("canvas");
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE / 2;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(diffuse.image as HTMLCanvasElement, 0, 0);
  const srcData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const imageData = ctx.createImageData(canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;
  const strength = 2;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const idx = (py * w + px) * 4;
      const left = ((py * w + Math.max(0, px - 1)) * 4);
      const right = ((py * w + Math.min(w - 1, px + 1)) * 4);
      const up = ((Math.max(0, py - 1) * w + px) * 4);
      const down = ((Math.min(h - 1, py + 1) * w + px) * 4);

      const gl = srcData[left] / 255;
      const gr = srcData[right] / 255;
      const gu = srcData[up] / 255;
      const gd = srcData[down] / 255;

      const dx = (gl - gr) * strength;
      const dy = (gu - gd) * strength;
      const dz = 1 / Math.sqrt(dx * dx + dy * dy + 1);

      data[idx] = Math.round((dx * dz * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((dy * dz * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((dz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function generateRoughnessMap(bodyId: string, type: string): THREE.CanvasTexture {
  const diffuse = generateDiffuseMap(bodyId, type);
  const canvas = document.createElement("canvas");
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE / 2;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(diffuse.image as HTMLCanvasElement, 0, 0);
  const srcData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const imageData = ctx.createImageData(canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < srcData.length; i += 4) {
    const gray = (srcData[i] + srcData[i + 1] + srcData[i + 2]) / (255 * 3);
    data[i] = data[i + 1] = data[i + 2] = Math.round(gray * 200);
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function generateEmissiveMap(bodyId: string, type: string): THREE.CanvasTexture | null {
  const def = TEXTURE_DEFS[bodyId] ?? getDef(bodyId);
  if (!def.emissive) return null;
  const emColor = def.emissiveColor ?? [1, 0.5, 0.1];
  const canvas = document.createElement("canvas");
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE / 2;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const val = 0.3 + Math.random() * 0.7;
    data[i] = Math.round(emColor[0] * val * 255);
    data[i + 1] = Math.round(emColor[1] * val * 255);
    data[i + 2] = Math.round(emColor[2] * val * 255);
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

const textureCache = new Map<string, THREE.CanvasTexture>();

function cached(fn: (bodyId: string, type: string) => THREE.CanvasTexture, key: string, bodyId: string, type: string): THREE.CanvasTexture {
  const k = `${key}:${bodyId}`;
  if (textureCache.has(k)) return textureCache.get(k)!;
  const tex = fn(bodyId, type);
  textureCache.set(k, tex);
  return tex;
}

export function getCachedDiffuse(bodyId: string, type: string): THREE.CanvasTexture {
  return cached(generateDiffuseMap, "diff", bodyId, type);
}

export function getCachedNormal(bodyId: string, type: string): THREE.CanvasTexture {
  return cached(generateNormalMap, "norm", bodyId, type);
}

export function getCachedRoughness(bodyId: string, type: string): THREE.CanvasTexture {
  return cached(generateRoughnessMap, "rough", bodyId, type);
}

export function getCachedEmissive(bodyId: string, type: string): THREE.CanvasTexture | null {
  const def = TEXTURE_DEFS[bodyId] ?? getDef(bodyId);
  if (!def.emissive) return null;
  const k = `emis:${bodyId}`;
  if (textureCache.has(k)) return textureCache.get(k)!;
  const tex = generateEmissiveMap(bodyId, type);
  if (tex) textureCache.set(k, tex);
  return tex;
}

export function applyProceduralMaterials(
  scene: THREE.Object3D,
  bodyId: string,
  type: string,
): void {
  const diffMap = getCachedDiffuse(bodyId, type);
  const normMap = getCachedNormal(bodyId, type);
  const roughMap = getCachedRoughness(bodyId, type);
  const emisMap = getCachedEmissive(bodyId, type);

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat && mat.isMaterial) {
        mat.map = diffMap;
        mat.normalMap = normMap;
        mat.normalScale = new THREE.Vector2(1.5, 1.5);
        mat.roughnessMap = roughMap;
        mat.roughness = 0.8;
        mat.metalness = 0.1;
        if (emisMap) {
          mat.emissiveMap = emisMap;
          mat.emissive = new THREE.Color(1, 0.5, 0.1);
          mat.emissiveIntensity = 1.5;
        }
        mat.needsUpdate = true;
      }
    }
  });
}
