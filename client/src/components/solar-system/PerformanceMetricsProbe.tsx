import { usePerformanceMonitor } from "@/hooks/usePerformance";
import { usePerformanceStore } from "@/stores/performance";

/**
 * R3F-side performance probe — must live INSIDE the Canvas because
 * usePerformanceMonitor calls useThree/useFrame. Metrics are published to the
 * zustand store so the DOM overlay can read them without R3F hooks.
 */
export default function PerformanceMetricsProbe() {
  const enabled = usePerformanceStore((s) => s.enabled);
  usePerformanceMonitor(enabled);
  return null;
}