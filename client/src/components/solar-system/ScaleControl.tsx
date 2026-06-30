import { useState } from "react";

export type ScaleMode = "visual" | "realSize" | "realDistance" | "hybrid";

const SCALE_MODES: { id: ScaleMode; label: string; description: string }[] = [
  {
    id: "visual",
    label: "Visual Scale",
    description: "Balanced view for solar system exploration. Objects sized for visibility, distances compressed.",
  },
  {
    id: "realSize",
    label: "Real Planet Size",
    description: "Accurate relative sizes. Planets shown at correct size ratios (Earth = 1 unit).",
  },
  {
    id: "realDistance",
    label: "Real Distance Scale",
    description: "Accurate orbital distances. Shows true astronomical unit distances.",
  },
  {
    id: "hybrid",
    label: "Hybrid Scale",
    description: "Compromise for usability. Sizes and distances balanced for learning.",
  },
];

type ScaleControlProps = {
  currentMode: ScaleMode;
  onModeChange: (mode: ScaleMode) => void;
  className?: string;
};

export default function ScaleControl({ currentMode, onModeChange, className = "" }: ScaleControlProps) {
  return (
    <div className={`pointer-events-auto absolute bottom-6 left-4 right-4 sm:left-8 sm:right-auto sm:max-w-md ${className}`}>
      <div className="rounded-xl border border-white/10 bg-black/60 backdrop-blur-md p-4">
        {/* Scale mode selector */}
        <div className="mb-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
              Scale Mode
            </div>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70 uppercase">
              {SCALE_MODES.find((m) => m.id === currentMode)?.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SCALE_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => onModeChange(mode.id)}
                className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition ${
                  currentMode === mode.id
                    ? "bg-white text-black"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="text-[10px] leading-relaxed text-white/50">
          {SCALE_MODES.find((m) => m.id === currentMode)?.description}
        </div>

        {/* Educational note */}
        <div className="mt-3 border-t border-white/10 pt-2 text-[9px] text-white/30">
          Note: Real solar system scales are impractical for visualization. Visual Scale
          compresses distances while exaggerating planet sizes to make the system viewable.
        </div>
      </div>
    </div>
  );
}
