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
};

export default function BodyDetailModal({ body, onClose, positions }: Props) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="relative mx-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-gray-950 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-gray-950/90 px-5 py-3 backdrop-blur-md">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
              {body.type.replace(/([A-Z])/g, " $1").trim()}
            </div>
            <div className="text-xl font-light text-white">{body.name}</div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            \u2715
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm leading-relaxed text-white/60">{body.fact}</p>

          {body.missionInfo && <MissionInfoCard info={body.missionInfo} />}

          <div className="mt-4">
            <EnhancedDataExplorer body={body} className="!border-0 !bg-transparent !p-0 !backdrop-blur-none" />
          </div>

          {similar.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Similar bodies
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
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
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white"
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
