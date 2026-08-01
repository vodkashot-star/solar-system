import { useEffect, useState, useSyncExternalStore } from "react";
import { subscribe, getSnapshot } from "@/lib/load-debugger";
import { BODIES } from "./bodies";

const TOTAL_BODIES = BODIES.length;

const LOADING_ICON = "\u25CB";
const LOADED_ICON = "\u2713";

export default function LoadingSpinner() {
  const entries = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const loadedCount = entries.filter((e) => e.status === "loaded").length;
  const loadingCount = entries.filter((e) => e.status === "loading").length;
  const errorCount = entries.filter((e) => e.status === "error").length;
  const anyBodyReady = loadedCount + errorCount >= 1;
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(id);
  }, []);

  // Never block the scene: hide as soon as the first body is ready (lazy
  // loading means the rest stream in on demand) or after a short cap.
  if (anyBodyReady || timedOut) return null;

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
            style={{ width: `${TOTAL_BODIES > 0 ? ((loadedCount + errorCount) / TOTAL_BODIES) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-white/50">{loadedCount}/{TOTAL_BODIES}</span>
      </div>

      <p className="mt-2 text-xs tracking-[0.15em] text-white/30 uppercase">
        {errorCount > 0
          ? `Loading — ${errorCount} failed`
          : loadingCount > 0
            ? `Loading ${loadingCount} body${loadingCount > 1 ? "ies" : "y"}...`
            : "Loading solar system"}
      </p>

      <div className="mt-4 max-h-40 overflow-y-auto px-4">
        <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[10px] font-mono sm:grid-cols-4 md:grid-cols-5">
          {entries.map((e) => (
            <div key={e.bodyId} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className={e.status === "loaded" ? "text-emerald-400" : e.status === "error" ? "text-red-400" : "text-amber-400"}>
                {e.status === "loaded" ? LOADED_ICON : LOADING_ICON}
              </span>
              <span className={e.status === "loaded" ? "text-white/50" : "text-white/70"}>
                {e.bodyName}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
