import { useMemo, useRef, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useCinematicMode } from "@/stores/cinematic-mode";
import { useSimulation } from "@/stores/simulation";

type Props = {
  count?: number;
  radius?: number;
  depth?: number;
  factor?: number;
  fade?: boolean;
};

const _v = new THREE.Vector3();

function randomInSphere(radius: number, depth: number) {
  const r = radius * (0.5 + Math.random() * 0.5);
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  _v.setFromSphericalCoords(r, phi, theta);
  _v.z *= depth / radius;
  return _v.clone();
}

function pickStarColor(color: THREE.Color) {
  const roll = Math.random();
  let h: number, s: number, l: number;
  if (roll < 0.5) {
    h = 0.0 + Math.random() * 0.07;
    s = 0.4 + Math.random() * 0.4;
    l = 0.4 + Math.random() * 0.4;
  } else if (roll < 0.75) {
    h = 0.07 + Math.random() * 0.06;
    s = 0.2 + Math.random() * 0.3;
    l = 0.5 + Math.random() * 0.4;
  } else if (roll < 0.9) {
    h = 0.13 + Math.random() * 0.07;
    s = 0.1 + Math.random() * 0.2;
    l = 0.6 + Math.random() * 0.35;
  } else if (roll < 0.97) {
    h = 0.55 + Math.random() * 0.1;
    s = 0.3 + Math.random() * 0.4;
    l = 0.6 + Math.random() * 0.35;
  } else {
    h = 0.7 + Math.random() * 0.15;
    s = 0.2 + Math.random() * 0.3;
    l = 0.5 + Math.random() * 0.3;
  }
  color.setHSL(h, s, l);
}

function makeStarTexture(size = 64): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.15, "rgba(255,255,255,0.8)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.25)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const starTexture = makeStarTexture();

export default function InstancedStars({
  count = 6000,
  radius = 200,
  depth = 80,
  factor = 4,
  fade = true,
}: Props) {
  const meshRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const cinematic = useCinematicMode((s) => s.enabled);
  const speed = useSimulation((s) => s.speed);

  // Reduce star count on mobile devices (lower DPR = lower-end device)
  const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  const isMobile = devicePixelRatio < 2 || /Android|iPhone|iPad/i.test(navigator.userAgent);
  const effectiveCount = isMobile ? Math.floor(count * 0.5) : count;

  const { geometry } = useMemo(() => {
    const positions = new Float32Array(effectiveCount * 3);
    const colors = new Float32Array(effectiveCount * 3);
    const sizes = new Float32Array(effectiveCount);
    const phases = new Float32Array(effectiveCount);

    const color = new THREE.Color();

    for (let i = 0; i < effectiveCount; i++) {
      const p = randomInSphere(radius, depth);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;

      pickStarColor(color);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = factor * (0.3 + Math.random() * 1.7);
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));
    geo.setAttribute("phase", new THREE.Float32BufferAttribute(phases, 1));
    return { geometry: geo };
  }, [effectiveCount, radius, depth, factor]);

  const uniformsRef = useRef<{ uTime: { value: number } }>({ uTime: { value: 0 } });

  useFrame((state, delta) => {
    uniformsRef.current.uTime.value += delta;
    // Paused (speed 0, no tour) → nothing else invalidates either; freeze.
    if (speed > 0 || cinematic) {
      if (meshRef.current) meshRef.current.rotation.y += delta * 0.001;
      state.invalidate();
    }
  });

  const onBeforeCompile = useCallback((shader: { uniforms: Record<string, { value: unknown }>; vertexShader: string }, _renderer: unknown) => {
    shader.uniforms.uTime = uniformsRef.current.uTime;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute float phase;
uniform float uTime;`,
      )
      .replace(
        "gl_PointSize = size * ptScale;",
        `float twinkle = 0.7 + 0.3 * sin(uTime * 1.5 + phase * 2.0);
gl_PointSize = size * ptScale * twinkle;`,
      );
  }, []);

  return (
    <points ref={meshRef} geometry={geometry} frustumCulled={true}>
      <pointsMaterial
        ref={materialRef}
        size={isMobile ? 0.8 : 1}
        map={starTexture}
        vertexColors
        transparent
        opacity={fade ? (isMobile ? 0.6 : 0.8) : 1}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        onBeforeCompile={onBeforeCompile}
      />
    </points>
  );
}
