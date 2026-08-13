import { useThree } from "@react-three/fiber";
import { PerformanceMonitor, usePerformanceMonitor } from "@react-three/drei";

/**
 * Adaptive quality bridge (frameloop="demand" safe — the monitor only samples
 * frames that actually render, i.e. while the tour/animation runs).
 *
 * drei's PerformanceMonitor samples FPS and decays a 0..1 `factor`; the driver
 * maps that onto the renderer's pixel ratio, so a slow device sheds resolution
 * (DPR 1.75 → 1.0) instead of dropping frames, and recovers when it can.
 * Must live INSIDE the Canvas (uses useThree).
 */
function QualityDriver() {
  const setDpr = useThree((s) => s.setDpr);
  const initialDpr = useThree((s) => s.viewport.initialDpr);

  usePerformanceMonitor({
    onChange: (api) => {
      setDpr(Math.max(1, initialDpr * api.factor));
    },
  });

  return null;
}

export default function AdaptiveQuality() {
  return (
    <PerformanceMonitor iterations={10} ms={250} threshold={0.75} step={0.15}>
      <QualityDriver />
    </PerformanceMonitor>
  );
}