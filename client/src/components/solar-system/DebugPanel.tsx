import { useSyncExternalStore, useState, useEffect } from "react";
import { subscribe, getSnapshot } from "@/lib/load-debugger";
import type { LoadStatus } from "@/lib/load-debugger";

// Only render in dev or when ?debug is in the URL
const IS_DEV = import.meta.env.DEV;
function isDebugMode() {
  if (IS_DEV) return true;
  try {
    return new URLSearchParams(window.location.search).has("debug");
  } catch {
    return false;
  }
}

const DEBUG_MODE = isDebugMode();
const LS_KEY = "debugpanel:minimized";

function formatTime(ms: number) {
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function icon(s: LoadStatus) {
  if (s.status === "loading") return "\u25CB";
  if (s.status === "loaded") return "\u2713";
  return "\u2717";
}

function statusClass(s: LoadStatus) {
  if (s.status === "loading") return "text-amber-400";
  if (s.status === "loaded") return "text-emerald-400";
  return "text-red-400";
}

export default function DebugPanel() {
  const entries = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Persist minimized state across page loads
  const [minimized, setMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, minimized ? "1" : "0");
    } catch {
      // localStorage unavailable — ignore
    }
  }, [minimized]);

  if (!DEBUG_MODE) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 font-mono text-[11px] leading-relaxed">
      <div className="pointer-events-auto rounded-lg border border-white/10 bg-black/70 p-3 backdrop-blur-md">
        <button
          onClick={() => setMinimized((v) => !v)}
          className="mb-1 w-full text-left text-[10px] font-semibold tracking-wider text-white/40 uppercase"
        >
          {minimized ? `GLB [\u25B6] ${entries.filter((e) => e.status === "loaded").length}/${entries.length}` : `GLB Load ${"\u25BC"}`}
        </button>

        {!minimized && (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[10px] text-white/30 uppercase">
                <th className="pr-3 text-left font-normal">Body</th>
                <th className="pr-3 text-left font-normal">URL</th>
                <th className="pr-3 text-right font-normal">Time</th>
                <th className="text-right font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.bodyId} className="border-t border-white/5">
                  <td className="pr-3 pt-0.5 text-white/80">{e.bodyName}</td>
                  <td className="max-w-[180px] overflow-hidden pr-3 pt-0.5 text-ellipsis whitespace-nowrap text-white/40" title={e.url}>
                    {e.url.replace("/models/", "")}
                  </td>
                  <td className="pr-3 pt-0.5 text-right tabular-nums text-white/50">
                    {e.endTime ? formatTime(e.endTime - e.startTime) : "\u2014"}
                  </td>
                  <td className={`pt-0.5 text-right ${statusClass(e)}`}>
                    {icon(e)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!minimized &&
          entries
            .filter((e) => e.error)
            .map((e) => (
              <div key={`err-${e.bodyId}`} className="mt-1 rounded bg-red-950/60 px-2 py-1 text-[10px] leading-snug text-red-300">
                {e.bodyName}: {e.error}
              </div>
            ))}
      </div>
    </div>
  );
}
