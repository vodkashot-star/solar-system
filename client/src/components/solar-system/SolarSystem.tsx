import { useRef, useState, useMemo, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { BODIES, type Body } from "./bodies";
import Planet from "./Planet";
import OrbitRings from "./OrbitRings";
import InstancedStars from "./InstancedStars";
import CinematicTour from "./CinematicTour";
import FocusCamera from "./FocusCamera";
import LoadingSpinner from "./LoadingSpinner";
import DebugPanel from "./DebugPanel";
import { useCameraFocus } from "@/stores/camera-focus";

export default function SolarSystem() {
  const [tourOn, setTourOn] = useState(true);
  const [active, setActive] = useState<Body>(BODIES[0]);
  const [scaleMode, setScaleMode] = useState<"cinematic" | "realistic">("cinematic");
  const [contextLost, setContextLost] = useState(false);
  const positions = useRef<Record<string, THREE.Vector3>>({});
  const computedRadii = useRef<Record<string, number>>({});
  const clearFocus = useCameraFocus((s) => s.clear);

  const scaleMultiplier = scaleMode === "cinematic" ? 1 : 0.25;

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

  const toggleScale = useCallback(() => {
    setScaleMode((m) => (m === "cinematic" ? "realistic" : "cinematic"));
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
          <Planet key={b.id} body={b} onPosition={reportPosCallbacks[b.id]} scaleMultiplier={scaleMultiplier} onComputedRadius={reportComputedRadius} />
        ))}

        <FocusCamera computedRadii={computedRadii} />
        <CinematicTour enabled={tourOn} onActiveChange={setActive} positions={positions} computedRadii={computedRadii} />

        {!tourOn && (
          <OrbitControls enableDamping />
        )}

        <EffectComposer>
          <Bloom intensity={0.9} luminanceThreshold={0.6} luminanceSmoothing={0.2} mipmapBlur />
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
          <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-400/80">
            {scaleMode}
          </span>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={toggleScale}
            className="rounded border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[11px] text-white/60 backdrop-blur transition hover:bg-white/10"
          >
            {scaleMode === "cinematic" ? "REALISTIC" : "CINEMATIC"}
          </button>
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
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
            Now viewing
          </div>
          <div className="mt-1 text-3xl font-light text-white">{active.name}</div>
          <p className="mt-2 text-sm leading-relaxed text-white/60">{active.fact}</p>
        </div>
      </div>

      <LoadingSpinner />
      <DebugPanel />
    </div>
  );
}
