/**
 * glow-textures.ts
 *
 * Shared radial-gradient canvas texture helpers for additive glow sprites
 * (SunGlow, AtmosphereGlow). Builds a THREE.CanvasTexture from a list of
 * (offset, color) stops — reused across components to avoid duplicated
 * canvas/gradient boilerplate.
 */

import * as THREE from "three";

export type GlowStop = readonly [offset: number, color: string];

/**
 * Convert a CSS hex colour string (e.g. `"#4fc3f7"`) to an
 * `rgba(r, g, b, a)` string. Falls back to transparent white on parse error.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(255,255,255,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Build a square radial-gradient glow texture from explicit colour stops.
 * Stops run from the centre (0) to the edge (1); pass fully transparent
 * stops at the ends to feather the sprite edge.
 */
export function makeGlowTexture(size: number, stops: readonly GlowStop[]): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
