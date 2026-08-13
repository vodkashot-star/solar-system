import { create } from "zustand";
import type { PerformanceMetrics } from "@/hooks/usePerformance";

type PerformanceState = {
  metrics: PerformanceMetrics;
  enabled: boolean;
  setMetrics: (metrics: PerformanceMetrics) => void;
  setEnabled: (enabled: boolean) => void;
};

const INITIAL_METRICS: PerformanceMetrics = {
  fps: 60,
  frameTime: 16.67,
  drawCalls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  programs: 0,
};

/**
 * WebGL metrics bridge — the R3F probe (inside the Canvas) writes metrics here;
 * the DOM overlay (outside the Canvas) reads them. Keeps R3F hooks away from
 * components rendered outside the Canvas.
 */
export const usePerformanceStore = create<PerformanceState>((set) => ({
  metrics: INITIAL_METRICS,
  enabled: false,
  setMetrics: (metrics) => set({ metrics }),
  setEnabled: (enabled) => set({ enabled }),
}));