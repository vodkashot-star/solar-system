import { useEffect, useRef } from "react";
import * as THREE from "three";
import { type Body, type MissionInfo, BODIES } from "./bodies";
import EnhancedDataExplorer from "./EnhancedDataExplorer";
import { useCameraFocus } from "@/stores/camera-focus";

const STATUS_STYLES: Record<MissionInfo["status"], string> = {
  Active:     "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Historical: "bg-amber-500/20   text-amber-300   border-amber-500/30",
  Lost:       "bg-red-500/20     text-red-300     border-red-500/30",
};

function MissionInfoCard({ info }: { info: MissionInfo }) {
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">
          Mission Info
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[info.status]}`}
        >
          {info.status}
        </span>
      </div>

      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="text-sm font-medium text-white/90">{info.agency}</span>
        <span className="text-xs text-white/40">·</span>
        <span className="text-xs text-white/60">Launched {info.launched}</span>
      </div>

      <div className="mb-3 text-xs text-white/50">
        <span className="text-white/30">Target: </span>
        {info.target}
      </div>

      <p className="text-xs leading-relaxed text-white/55">{info.description}</p>
    </div>
  );
}

type Props = {
  body: Body | null;
  onClose: () => void;
  positions: React.MutableRefObject<Record<string, THREE.Vector3>>;
  /** Delete handler for custom (API-created) bodies. */
  onDeleteCustom?: (bodyId: string) => Promise<boolean> | boolean;
};

export default function BodyDetailModal({ body, onClose, positions, onDeleteCustom }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const focus = useCameraFocus((s) => s.focus);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!body) return null;

  const similar = body.aiAnalysis?.similarObjects ?? [];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="relative w-full sm:mx-4 max-h-[90vh] sm:max-h-[85vh] sm:w-full sm:max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-2xl border-t border-white/15 sm:border border-white/15 bg-gray-950 shadow-2xl">
        {/* Mobile handle indicator */}
        <div className="sticky top-0 z-10 flex justify-center pt-2 pb-1 sm:hidden bg-gray-950">
          <div className="w-12 h-1 rounded-full bg-white/20" />
        </div>
        
        <div className="sticky top-0 sm:top-0 z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 bg-gray-950/95 px-4 sm:px-5 py-3 sm:py-3 backdrop-blur-md">
          <div className="flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
              {body.type.replace(/([A-Z])/g, " $1").trim()}
            </div>
            <div className="text-xl sm:text-xl font-light text-white mt-0.5">{body.name}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {onDeleteCustom && (
              <button
                onClick={async () => {
                  if (!confirm(`Remove ${body.name} from the system?`)) return;
                  const ok = await onDeleteCustom(body.id);
                  if (ok) onClose();
                }}
                aria-label={`Remove ${body.name}`}
                title="Remove this custom body"
                className="min-h-[44px] rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-300 transition-all duration-150 hover:bg-red-500/20 active:scale-95"
              >
                Remove
              </button>
            )}
            {body.glbUrl && (
              <a
                href={`?model=${encodeURIComponent(body.id)}`}
                aria-label={`Inspect the 3D model of ${body.name}`}
                title="Open the raw GLB model in the 3D studio"
                className="min-h-[44px] flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-95"
              >
                <span className="hidden xs:inline">View 3D model</span>
                <span className="xs:hidden">3D</span>
              </a>
            )}
            <button
              onClick={onClose}
              aria-label="Close details panel"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/10 bg-white/5 text-base text-white/60 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-95"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-4 sm:py-5">
          <p className="text-sm leading-relaxed text-white/60">{body.fact}</p>

          {body.missionInfo && <MissionInfoCard info={body.missionInfo} />}

          <div className="mt-4">
            <EnhancedDataExplorer body={body} className="!border-0 !bg-transparent !p-0 !backdrop-blur-none" />
          </div>

          {similar.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-3">
                Similar bodies
              </div>
              <div className="flex flex-wrap gap-2">
                {similar.map(({ bodyId }) => {
                  const match = BODIES.find((b) => b.id === bodyId);
                  if (!match) return null;
                  return (
                    <button
                      key={bodyId}
                      onClick={() => {
                        const pos = positions.current[bodyId];
                        if (pos) {
                          focus(bodyId);
                          onClose();
                        }
                      }}
                      aria-label={`Focus on ${match.name}`}
                      className="min-h-[44px] flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-95"
                    >
                      {match.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
