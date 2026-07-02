import { useEffect, useRef } from "react";
import * as THREE from "three";
import { type Body, BODIES } from "./bodies";
import EnhancedDataExplorer from "./EnhancedDataExplorer";
import { useCameraFocus } from "@/stores/camera-focus";

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
