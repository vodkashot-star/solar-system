/**
 * PerformanceMonitor.tsx
 * 
 * Visual overlay showing real-time performance metrics
 * Can be toggled with keyboard shortcut (Shift+P)
 */

import { useState, useEffect } from "react";
import { usePerformanceMonitor, analyzePerformance, detectDeviceCapabilities } from "@/hooks/usePerformance";

export default function PerformanceMonitor() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const metrics = usePerformanceMonitor(visible);
  const analysis = analyzePerformance(metrics);
  const deviceInfo = detectDeviceCapabilities();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle with Shift+P
      if (e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setVisible((v) => !v);
      }
      // Expand with Shift+E when visible
      if (visible && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        setExpanded((v) => !v);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible]);

  if (!visible) return null;

  const levelColors = {
    high: "text-green-400 border-green-500/30 bg-green-500/10",
    medium: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
    low: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    critical: "text-red-400 border-red-500/30 bg-red-500/10",
  };

  const fpsColor = metrics.fps >= 55 ? "text-green-400" : metrics.fps >= 40 ? "text-yellow-400" : metrics.fps >= 25 ? "text-orange-400" : "text-red-400";

  return (
    <div className="pointer-events-auto fixed top-2 right-2 z-50 font-mono text-xs sm:top-4 sm:right-4">
      <div className="rounded-xl border border-white/15 bg-black/90 p-3 backdrop-blur-xl shadow-2xl">
        {/* Compact FPS Display */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-white/50">FPS</span>
            <span className={`text-2xl font-bold tabular-nums ${fpsColor}`}>{metrics.fps}</span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/50 transition hover:bg-white/10 hover:text-white"
            aria-label={expanded ? "Collapse metrics" : "Expand metrics"}
          >
            {expanded ? "▼" : "▶"}
          </button>
        </div>

        {/* Expanded Metrics */}
        {expanded && (
          <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
            {/* Performance Level Badge */}
            <div className={`rounded-lg border px-2 py-1.5 ${levelColors[analysis.level]}`}>
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                Performance: {analysis.level}
              </div>
              <div className="mt-0.5 text-[11px]">{analysis.message}</div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] text-white/40">Frame Time</div>
                <div className="text-white/90">{metrics.frameTime}ms</div>
              </div>
              <div>
                <div className="text-[10px] text-white/40">Draw Calls</div>
                <div className="text-white/90">{metrics.drawCalls}</div>
              </div>
              <div>
                <div className="text-[10px] text-white/40">Triangles</div>
                <div className="text-white/90">{(metrics.triangles / 1000).toFixed(1)}k</div>
              </div>
              <div>
                <div className="text-[10px] text-white/40">Textures</div>
                <div className="text-white/90">{metrics.textures}</div>
              </div>
              <div>
                <div className="text-[10px] text-white/40">Geometries</div>
                <div className="text-white/90">{metrics.geometries}</div>
              </div>
              <div>
                <div className="text-[10px] text-white/40">Programs</div>
                <div className="text-white/90">{metrics.programs}</div>
              </div>
            </div>

            {/* Device Info */}
            <div className="border-t border-white/10 pt-2">
              <div className="text-[10px] uppercase tracking-wider text-white/40">Device</div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/70">
                <span>Tier: {deviceInfo.tier}</span>
                <span>DPR: {deviceInfo.dpr}</span>
                <span>{deviceInfo.isMobile ? "Mobile" : "Desktop"}</span>
              </div>
            </div>

            {/* Recommendations */}
            {analysis.recommendations.length > 0 && analysis.recommendations[0] !== "No optimizations needed" && (
              <div className="border-t border-white/10 pt-2">
                <div className="text-[10px] uppercase tracking-wider text-white/40">Recommendations</div>
                <ul className="mt-1 space-y-1 text-[10px] text-white/60">
                  {analysis.recommendations.slice(0, 3).map((rec, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-white/30">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Help Text */}
            <div className="border-t border-white/10 pt-2 text-[9px] text-white/30">
              Shift+P: Toggle • Shift+E: Expand/Collapse
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
