import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { BODIES, type Body, type AIAnalysis } from "./bodies";
import Planet from "./Planet";
import OrbitRings from "./OrbitRings";
import InstancedStars from "./InstancedStars";
import CinematicTour from "./CinematicTour";
import FocusCamera from "./FocusCamera";
import LoadingSpinner from "./LoadingSpinner";
import DebugPanel from "./DebugPanel";
import AIClassificationPanel from "./AIClassificationPanel";
import BodyDetailModal from "./BodyDetailModal";
import ScaleControl, { type ScaleMode } from "./ScaleControl";
import { useCameraFocus } from "@/stores/camera-focus";

export default function SolarSystem() {
  const [tourOn, setTourOn] = useState(true);
  const [active, setActive] = useState<Body>(BODIES[0]);
  const [scaleMode, setScaleMode] = useState<ScaleMode>("visual");
  const [contextLost, setContextLost] = useState(false);
  const [aiCache, setAiCache] = useState<Record<string, AIAnalysis>>({});
  const [hoveredBodyId, setHoveredBodyId] = useState<string | null>(null);
  const [detailBodyId, setDetailBodyId] = useState<string | null>(null);
  const positions = useRef<Record<string, THREE.Vector3>>({});
  const computedRadii = useRef<Record<string, number>>({});
  const clearFocus = useCameraFocus((s) => s.clear);
  const focus = useCameraFocus((s) => s.focus);

  useEffect(() => {
    if (aiCache[active.id]) return;
    const { orbitalPeriod, axialTilt, mass, radius, eccentricity } = active.properties;
    const params = new URLSearchParams({
      orbital_period: String(orbitalPeriod),
      axial_tilt: String(axialTilt),
      mass: String(mass),
      radius: String(radius),
      eccentricity: String(eccentricity),
    });
    fetch(`/api/ai/classify/${active.id}?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: AIAnalysis | null) => {
        if (data) setAiCache((c) => ({ ...c, [active.id]: data }));
      })
      .catch(() => {/* AI service offline — fail silently */});
  }, [active.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const scaleMultiplier =
    scaleMode === "visual" ? 1 :
    scaleMode === "hybrid" ? 0.6 :
    scaleMode === "realSize" ? 0.35 :
    0.25; // realDistance

  const reportPosCallbacks = useMemo(() => {
    const map: Record<string, (p: THREE.Vector3) => void> = {};
    for (const b of BODIES) {
      map[b.id] = (p: THREE.Vector3) => {
        if (!positions.current[b.id]) positions.current[b.id] = new THREE.Vector3();
        positions.current[b.id].copy(p);
      };
    }
    return map;
  }, []);

  const reportComputedRadius = useCallback((bodyId: string, radius: number) => {
    computedRadii.current[bodyId] = radius;
  }, []);

  const handleHover = useCallback((bodyId: string | null) => {
    setHoveredBodyId(bodyId);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <Canvas
        camera={{ position: [0, 18, 60], fov: 50, near: 0.1, far: 1500 }}
        dpr={[1, 1.75]}
        gl={{ powerPreference: "high-performance" }}
        frameloop="demand"
        onCreated={(state) => {
          state.invalidate();
          const canvas = state.gl.domElement;
          canvas.addEventListener('webglcontextlost', (e: Event) => {
            e.preventDefault();
            setContextLost(true);
          });
          canvas.addEventListener('webglcontextrestored', () => {
            setContextLost(false);
            state.invalidate();
          });
        }}
      >
        <color attach="background" args={["#02030a"]} />
        <ambientLight intensity={0.08} />
        <pointLight position={[0, 0, 0]} intensity={3.5} distance={200} decay={1.2} color="#ffd9a0" />

        <InstancedStars radius={200} depth={80} count={6000} factor={4} saturation={0} fade />

        <OrbitRings scaleMultiplier={scaleMultiplier} />

        {BODIES.map((b) => (
          <Planet key={b.id} body={b} onPosition={reportPosCallbacks[b.id]} scaleMultiplier={scaleMultiplier} onComputedRadius={reportComputedRadius} onHover={handleHover} />
        ))}

        <FocusCamera computedRadii={computedRadii} />
        <CinematicTour enabled={tourOn} onActiveChange={setActive} positions={positions} computedRadii={computedRadii} />

        {!tourOn && (
          <OrbitControls enableDamping />
        )}

        <EffectComposer>
          <Bloom intensity={tourOn ? 0.9 : 0} luminanceThreshold={0.6} luminanceSmoothing={0.2} mipmapBlur />
        </EffectComposer>
      </Canvas>

      {contextLost && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="mb-4 h-12 w-12 rounded-full border-2 border-amber-500/60 border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-white/80">Graphics rendering lost</p>
          <p className="mt-1 text-xs text-white/40">Recovering...</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg border border-white/20 bg-white/5 px-6 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10"
          >
            Reload page
          </button>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-6">
        <div className="pointer-events-auto flex items-center gap-3">
          <h1 className="text-sm font-semibold tracking-[0.25em] text-white/80 uppercase">
            Solar System
          </h1>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <ScaleControl currentMode={scaleMode} onModeChange={setScaleMode} className="!static !bottom-auto !left-auto !right-auto" />
          <button
            onClick={() => {
              setTourOn((v) => {
                if (!v) clearFocus();
                return !v;
              });
            }}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/90 backdrop-blur-md transition hover:bg-white/10"
          >
            {tourOn ? "Pause tour \u00b7 Free look" : "Resume tour"}
          </button>
        </div>
      </div>

      <div
        key={active.id}
        className="pointer-events-none absolute bottom-6 left-4 right-4 animate-fade-in sm:left-8 sm:right-auto sm:max-w-md"
      >
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
                Now viewing
              </div>
              <div className="mt-1 text-3xl font-light text-white">{active.name}</div>
            </div>
            <button
              onClick={() => setDetailBodyId(active.id)}
              className="pointer-events-auto ml-3 mt-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-medium text-white/70 backdrop-blur transition hover:bg-white/10 hover:text-white"
            >
              Details
            </button>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white/60">{active.fact}</p>

          {aiCache[active.id] && (
            <>
              <div className="mt-4 border-t border-white/10 pt-4">
                <AIClassificationPanel
                  body={{ ...active, aiAnalysis: aiCache[active.id] }}
                  className="!border-0 !bg-transparent !p-0 !backdrop-blur-none"
                />
              </div>

              {aiCache[active.id].similarObjects.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                    Similar bodies
                  </div>
                  <div className="pointer-events-auto mt-1.5 flex flex-wrap gap-1.5">
                    {aiCache[active.id].similarObjects.map(({ bodyId }) => {
                      const match = BODIES.find((b) => b.id === bodyId);
                      if (!match) return null;
                      return (
                        <button
                          key={bodyId}
                          onClick={() => {
                            const pos = positions.current[bodyId];
                            if (pos) focus(bodyId, pos);
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
            </>
          )}
        </div>
      </div>

      <LoadingSpinner />
      <DebugPanel />

      {hoveredBodyId && (() => {
        const body = BODIES.find((b) => b.id === hoveredBodyId);
        if (!body) return null;
        return (
          <div className="pointer-events-none fixed top-4 left-1/2 z-40 -translate-x-1/2 animate-fade-in rounded-lg border border-white/10 bg-black/80 px-3 py-2 backdrop-blur-md">
            <div className="text-xs font-medium text-white">{body.name}</div>
            <div className="text-[10px] text-white/50">{body.type.replace(/([A-Z])/g, " $1").trim()}</div>
          </div>
        );
      })()}

      <BodyDetailModal
        body={detailBodyId ? BODIES.find((b) => b.id === detailBodyId) ?? null : null}
        onClose={() => setDetailBodyId(null)}
        positions={positions}
      />
    </div>
  );
}
