import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const ATMOSPHERE_COLORS: Record<string, string> = {
  earth: "#4fc3f7",
  venus: "#ffcc80",
  mars: "#ef9a9a",
  jupiter: "#d2a679",
  saturn: "#e8d8a0",
  neptune: "#5b9bd5",
};

/**
 * Convert a CSS hex colour string (e.g. `"#4fc3f7"`) to an
 * `rgba(r, g, b, a)` string. Falls back to transparent white on parse error.
 */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(255,255,255,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

function makeGlowTexture(size: number, color: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;
  const gradient = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.1, hexToRgba(color, 0.4));
  gradient.addColorStop(0.5, hexToRgba(color, 0.12));
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

type Props = {
  radius: number;
  bodyId: string;
};

export default function AtmosphereGlow({ radius, bodyId }: Props) {
  const ref = useRef<THREE.Sprite>(null);
  const color = ATMOSPHERE_COLORS[bodyId] ?? "#ffffff";
  const tex = useMemo(() => makeGlowTexture(128, color), [color]);

  useFrame(({ clock, invalidate }) => {
    if (ref.current) {
      const pulse = 1 + 0.02 * Math.sin(clock.elapsedTime * 0.5 + bodyId.charCodeAt(0));
      ref.current.scale.setScalar(radius * 3.2 * pulse);
    }
    invalidate();
  });

  return (
    <sprite ref={ref} scale={[radius * 3.2, radius * 3.2, 1]}>
      <spriteMaterial
        map={tex}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent
        opacity={0.5}
      />
    </sprite>
  );
}
