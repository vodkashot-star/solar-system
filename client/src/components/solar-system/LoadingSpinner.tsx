import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";

export default function LoadingSpinner() {
  const { progress, active } = useProgress();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), 15_000);
    return () => clearTimeout(id);
  }, []);

  if (!active || progress >= 100 || timedOut) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-700">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-white/10 border-t-amber-500/80" />
        <div className="absolute inset-2 animate-spin rounded-full border border-white/5 border-b-amber-400/50" style={{ animationDirection: "reverse", animationDuration: "1.2s" }} />
      </div>
      <div className="mt-6 flex items-center gap-3">
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-300 ease-out"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-white/50">{Math.round(progress)}%</span>
      </div>
      <p className="mt-3 text-xs tracking-[0.15em] text-white/30 uppercase">Loading solar system</p>
    </div>
  );
}
