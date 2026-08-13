/**
 * Performance monitoring hook for WebGL rendering
 * Tracks FPS, draw calls, memory usage, and provides adaptive quality suggestions
 */

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { usePerformanceStore } from "@/stores/performance";

export type PerformanceMetrics = {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  memoryUsage?: number;
};

export type PerformanceLevel = "high" | "medium" | "low" | "critical";

export type PerformanceSuggestions = {
  level: PerformanceLevel;
  message: string;
  recommendations: string[];
};

/**
 * R3F-only hook to monitor WebGL performance metrics.
 *
 * MUST be called inside a Canvas (uses useThree/useFrame) — call it from
 * PerformanceMetricsProbe, never from the DOM overlay. Metrics are published to
 * the performance store; the overlay subscribes there.
 */
export function usePerformanceMonitor(enabled: boolean = true) {
  const { gl } = useThree();
  const setMetrics = usePerformanceStore((s) => s.setMetrics);

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const frameTimes = useRef<number[]>([]);

  useFrame(() => {
    if (!enabled) return;

    const now = performance.now();
    const delta = now - lastTimeRef.current;

    frameCountRef.current++;
    frameTimes.current.push(delta);

    // Update metrics every 0.5 seconds
    if (delta >= 500) {
      const avgFrameTime = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length;
      const fps = 1000 / avgFrameTime;

      const info = gl.info.render;
      const memory = gl.info.memory;

      setMetrics({
        fps: Math.round(fps * 10) / 10,
        frameTime: Math.round(avgFrameTime * 100) / 100,
        drawCalls: info.calls,
        triangles: info.triangles,
        geometries: memory.geometries,
        textures: memory.textures,
        programs: gl.info.programs?.length || 0,
      });

      frameCountRef.current = 0;
      lastTimeRef.current = now;
      frameTimes.current = [];
    }
  });
}

/**
 * Analyze performance metrics and provide suggestions
 */
export function analyzePerformance(metrics: PerformanceMetrics): PerformanceSuggestions {
  const { fps, drawCalls, triangles, textures } = metrics;

  // Determine performance level
  let level: PerformanceLevel;
  if (fps >= 55) {
    level = "high";
  } else if (fps >= 40) {
    level = "medium";
  } else if (fps >= 25) {
    level = "low";
  } else {
    level = "critical";
  }

  const recommendations: string[] = [];

  if (fps < 40) {
    recommendations.push("Enable LOD system for distant objects");
  }

  if (drawCalls > 50) {
    recommendations.push(`High draw calls (${drawCalls}). Consider mesh instancing.`);
  }

  if (triangles > 500000) {
    recommendations.push(`High triangle count (${triangles}). Reduce geometry detail.`);
  }

  if (textures > 40) {
    recommendations.push(`Many textures loaded (${textures}). Consider texture atlasing.`);
  }

  if (fps < 30) {
    recommendations.push("Reduce star particle count");
    recommendations.push("Disable post-processing effects");
  }

  const messages = {
    high: "Performance is excellent! 🚀",
    medium: "Performance is good, minor optimizations possible.",
    low: "Performance is below target. Apply optimizations.",
    critical: "Performance is critical! Immediate action needed.",
  };

  return {
    level,
    message: messages[level],
    recommendations: recommendations.length > 0 ? recommendations : ["No optimizations needed"],
  };
}

/**
 * Detect device capabilities and suggest quality settings
 */
export function detectDeviceCapabilities(): {
  tier: "high" | "medium" | "low";
  isMobile: boolean;
  dpr: number;
  maxTextureSize: number;
} {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const dpr = window.devicePixelRatio || 1;
  
  // Create temporary WebGL context to check capabilities
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl") as WebGLRenderingContext | null;
  
  const maxTextureSize = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 2048;
  
  let tier: "high" | "medium" | "low";
  
  if (isMobile && dpr < 2) {
    tier = "low";
  } else if (isMobile || dpr < 2) {
    tier = "medium";
  } else {
    tier = "high";
  }

  return { tier, isMobile, dpr, maxTextureSize };
}
