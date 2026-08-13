import { useState, useRef, useEffect } from "react";

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
  compact?: boolean;
};

export default function ScaleControl({ currentMode, onModeChange, className = "", compact }: ScaleControlProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Compact pill + popover for inline/mobile use
  if (compact) {
    const current = SCALE_MODES.find((m) => m.id === currentMode);
    return (
      <div className="relative" ref={popoverRef}>
        <button
          onClick={() => setOpen(!open)}
          className="min-h-[44px] flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-medium text-white/70 backdrop-blur-md transition-all duration-200 hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95 sm:text-xs"
        >
          <span className="hidden xs:inline">{current?.label ?? currentMode}</span>
          <span className="xs:hidden">📐</span>
          <span className={`text-[10px] transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 z-50 w-48 max-w-[calc(100vw-1rem)] rounded-xl border border-white/15 bg-gray-950/95 p-1.5 shadow-2xl backdrop-blur-xl animate-fade-in">
            {SCALE_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => { onModeChange(mode.id); setOpen(false); }}
                className={`flex w-full items-center min-h-[44px] rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 ${
                  currentMode === mode.id
                    ? "bg-white/15 text-white"
                    : "text-white/50 hover:bg-white/5 hover:text-white/80 active:scale-95"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`pointer-events-auto absolute bottom-6 left-4 right-4 sm:left-8 sm:right-auto sm:max-w-md ${className}`}>
      <div className="rounded-xl border border-white/10 bg-black/60 p-4 backdrop-blur-md">
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

        <div className="text-[10px] leading-relaxed text-white/50">
          {SCALE_MODES.find((m) => m.id === currentMode)?.description}
        </div>

        <div className="mt-3 border-t border-white/10 pt-2 text-[9px] text-white/30">
          Note: Real solar system scales are impractical for visualization. Visual Scale
          compresses distances while exaggerating planet sizes to make the system viewable.
        </div>
      </div>
    </div>
  );
}
