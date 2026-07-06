import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { BODIES, type Body, type AIAnalysis } from "./bodies";
import Planet from "./Planet";
import OrbitRings from "./OrbitRings";
import InstancedStars from "./InstancedStars";
import NebulaBackground from "./NebulaBackground";
import CinematicTour from "./CinematicTour";
import FocusCamera from "./FocusCamera";
import SunGlow from "./SunGlow";
import LoadingSpinner from "./LoadingSpinner";
import DebugPanel from "./DebugPanel";
import AIClassificationPanel from "./AIClassificationPanel";
import BodyDetailModal from "./BodyDetailModal";
import ScaleControl, { type ScaleMode } from "./ScaleControl";
import BodySearch from "./BodySearch";
import { useCameraFocus } from "@/stores/camera-focus";
import { useCinematicMode } from "@/stores/cinematic-mode";
import SpacecraftOrbit from "./SpacecraftOrbit";

export default function SolarSystem() {
  const [tourOn, setTourOn] = useState(true);
  const [overview, setOverview] = useState(false);
  const [active, setActive] = useState<Body>(BODIES[0]);
  const [scaleMode, setScaleMode] = useState<ScaleMode>("visual");
  const [contextLost, setContextLost] = useState(false);
  const [aiCache, setAiCache] = useState<Record<string, AIAnalysis>>({});
  const [hoveredBodyId, setHoveredBodyId] = useState<string | null>(null);
  const [detailBodyId, setDetailBodyId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const positions = useRef<Record<string, THREE.Vector3>>({});
  const computedRadii = useRef<Record<string, number>>({});
  const clearFocus = useCameraFocus((s) => s.clear);
  const focus = useCameraFocus((s) => s.focus);
  const isFocused = useCameraFocus((s) => s.isFocused);
  const setCinematic = useCinematicMode((s) => s.setEnabled);

  useEffect(() => {
    if (isFocused) setOverview(false);
  }, [isFocused]);

  useEffect(() => {
    setCinematic(tourOn);
  }, [tourOn, setCinematic]);

  useEffect(() => {
    fetch("/api/ai/precomputed")
      .then((r) => r.ok ? r.json() : null)
      .then((data: Record<string, AIAnalysis> | null) => {
        if (data) setAiCache(data);
      })
      .catch(() => {/* AI service offline — fail silently */});
  }, []); // Empty deps intended - runs once on mount

  useEffect(() => {
    if (aiCache[active.id]) return;
    const {
      orbitalPeriod, axialTilt, mass, radius, eccentricity,
      density, gravity, temperature, semiMajorAxis, inclination, rotationPeriod,
    } = active.properties;
    const params = new URLSearchParams({
      orbital_period: String(orbitalPeriod),
      axial_tilt: String(axialTilt),
      mass: String(mass),
      radius: String(radius),
      eccentricity: String(eccentricity),
      density: String(density),
      gravity: String(gravity),
      temperature: String(temperature),
      semi_major_axis: String(semiMajorAxis),
      inclination: String(inclination),
      rotation_period: String(rotationPeriod),
    });
    fetch(`/api/ai/classify/${active.id}?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: AIAnalysis | null) => {
        if (data) setAiCache((c) => ({ ...c, [active.id]: data }));
      })
      .catch(() => {/* AI service offline — fail silently */});
  }, [active.id, aiCache, active.properties]);

  const currentIndex = BODIES.findIndex((b) => b.id === active.id);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " ") {
        e.preventDefault();
        setTourOn((v) => {
          if (!v) clearFocus();
          return !v;
        });
      } else if (e.key === "ArrowLeft") {
        const prev = BODIES[(currentIndex - 1 + BODIES.length) % BODIES.length];
        setTourOn(false);
        focus(prev.id);
      } else if (e.key === "ArrowRight") {
        const next = BODIES[(currentIndex + 1) % BODIES.length];
        setTourOn(false);
        focus(next.id);
      } else if (e.key === "Escape") {
        setDetailBodyId(null);
        setSearchOpen(false);
        clearFocus();
      } else if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, focus, clearFocus]);

  const scaleMultiplier =
    scaleMode === "visual" ? 1 :
    scaleMode === "hybrid" ? 0.6 :
    scaleMode === "realSize" ? 0.35 :
    0.25; // realDistance

  const nearPlane = 0.01;
  const farPlane = scaleMultiplier < 0.5 ? 400 : 1500;

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
      <div className="absolute inset-0" style={{ zIndex: 0, isolation: "isolate" }}>
        <Canvas
          camera={{ position: [0, 55, 130], fov: 55, near: nearPlane, far: farPlane }}
          dpr={[1, 1.75]}
          gl={{ powerPreference: "high-performance", logarithmicDepthBuffer: scaleMultiplier < 0.5 }}
          frameloop="demand"
          onCreated={(state) => {
            state.invalidate();
            const canvas = state.gl.domElement;

            const handleContextLost = (e: Event) => {
              e.preventDefault();
              setContextLost(true);
            };

            const handleContextRestored = () => {
              setContextLost(false);
              state.invalidate();
            };

            canvas.addEventListener('webglcontextlost', handleContextLost);
            canvas.addEventListener('webglcontextrestored', handleContextRestored);

            return () => {
              canvas.removeEventListener('webglcontextlost', handleContextLost);
              canvas.removeEventListener('webglcontextrestored', handleContextRestored);
            };
          }}
        >
          <color attach="background" args={["#02030a"]} />
          <ambientLight intensity={0.08} />
          <pointLight position={[0, 0, 0]} intensity={3.5} distance={200} decay={1.2} color="#ffd9a0" />

          <NebulaBackground />
          <InstancedStars radius={200} depth={80} count={6000} factor={4} fade />

          <SunGlow />

          <OrbitRings scaleMultiplier={scaleMultiplier} />

          {BODIES.filter((b) => b.type !== "spacecraft").map((b) => (
            <Planet key={b.id} body={b} onPosition={reportPosCallbacks[b.id]} scaleMultiplier={scaleMultiplier} onComputedRadius={reportComputedRadius} onHover={handleHover} speedMultiplier={speedMultiplier} />
          ))}

          {BODIES.filter((b) => b.type === "spacecraft").map((b) => (
            <SpacecraftOrbit
              key={b.id}
              body={b}
              parentPositionRef={positions}
              orbitRadius={b.parentBody ? (computedRadii.current[b.parentBody] ?? 1.5) * 2.2 : b.orbit}
              onPosition={reportPosCallbacks[b.id]}
              scaleMultiplier={scaleMultiplier}
              onComputedRadius={reportComputedRadius}
              onHover={handleHover}
              speedMultiplier={speedMultiplier}
            />
          ))}

          <FocusCamera positions={positions} computedRadii={computedRadii} />
          <CinematicTour enabled={tourOn} onActiveChange={setActive} onOverviewChange={setOverview} positions={positions} computedRadii={computedRadii} speedMultiplier={speedMultiplier} />

          {!tourOn && (
            <OrbitControls enableDamping {...({ dampingFactor: 0.15, minDistance: 2, maxDistance: 200, zoomSpeed: 0.8, rotateSpeed: 0.6 } as any)} />
          )}

          <EffectComposer>
            <Bloom intensity={tourOn ? 0.9 : 0} luminanceThreshold={0.6} luminanceSmoothing={0.2} mipmapBlur />
          </EffectComposer>
        </Canvas>
      </div>

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

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-1 p-1.5 sm:p-4">
        <div className="flex items-start justify-between">
          <div className="pointer-events-auto flex items-center gap-1.5">
            <h1 className="hidden text-xs font-semibold tracking-[0.2em] text-white/80 uppercase xs:inline sm:text-sm">
              Solar System
            </h1>
            <button
              onClick={() => setSearchOpen(true)}
              className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-medium text-white/60 backdrop-blur transition hover:bg-white/10 hover:text-white"
              title="Search bodies (/)"
            >
              Search
            </button>
          </div>
          <div className="pointer-events-auto flex items-center gap-1">
            <ScaleControl currentMode={scaleMode} onModeChange={setScaleMode} compact />
            <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-1.5 py-1 backdrop-blur-md sm:px-2">
              <span className="hidden text-[10px] text-white/50 sm:inline">Speed</span>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={speedMultiplier}
                onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
                className="h-2 w-10 cursor-pointer appearance-none rounded-full bg-white/20 accent-white sm:h-1 sm:w-16"
              />
              <span className="w-3 text-right text-[9px] font-medium text-white/70 sm:w-5 sm:text-[10px]">{speedMultiplier.toFixed(1)}x</span>
            </div>
            <button
              onClick={() => {
                setTourOn((v) => {
                  if (!v) clearFocus();
                  return !v;
                });
              }}
              className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-medium text-white/90 backdrop-blur-md transition hover:bg-white/10 sm:px-4 sm:py-1.5 sm:text-xs"
            >
              {tourOn ? "Pause" : "Tour"}
            </button>
          </div>
        </div>
      </div>

      <div
        key={overview ? "overview" : active.id}
        className="pointer-events-none absolute bottom-2 left-2 right-2 z-20 animate-fade-in sm:bottom-6 sm:left-8 sm:right-auto sm:max-w-xs"
      >
        {overview ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2 backdrop-blur-md sm:p-4">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
              Now viewing
            </div>
            <div className="mt-0.5 text-base font-light text-white sm:text-xl">Solar System</div>
            <p className="mt-1 text-[11px] leading-relaxed text-white/60 sm:text-xs">
              Our cosmic neighborhood — eight planets, five dwarf planets, hundreds of moons,
              and countless asteroids orbit a single yellow dwarf star.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2 backdrop-blur-md sm:p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
                  Now viewing
                </div>
                <div className="mt-0.5 truncate text-base font-light text-white sm:text-xl">{active.name}</div>
              </div>
              <button
                onClick={() => setDetailBodyId(active.id)}
                className="pointer-events-auto ml-2 mt-0.5 shrink-0 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/70 backdrop-blur transition hover:bg-white/10 hover:text-white"
              >
                Details
              </button>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-white/60 sm:text-xs">{active.fact}</p>

            {aiCache[active.id] && (
              <div className="mt-1.5 border-t border-white/10 pt-1.5 sm:mt-2 sm:pt-2">
                <AIClassificationPanel
                  body={{ ...active, aiAnalysis: aiCache[active.id] }}
                  className="!border-0 !bg-transparent !p-0 !backdrop-blur-none"
                  compact
                />
              </div>
            )}
          </div>
        )}
      </div>

      <LoadingSpinner />
      <DebugPanel />

      {hoveredBodyId && (() => {
        const body = BODIES.find((b) => b.id === hoveredBodyId);
        if (!body) return null;
        return (
          <div className="pointer-events-none fixed left-1/2 z-40 -translate-x-1/2 animate-fade-in rounded-lg border border-white/10 bg-black/80 px-3 py-1.5 backdrop-blur-md sm:bottom-20 bottom-auto top-20">
            <div className="text-xs font-medium text-white">{body.name}</div>
            <div className="text-[10px] text-white/50">{body.type.replace(/([A-Z])/g, " $1").trim()}</div>
          </div>
        );
      })()}

      <BodySearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(bodyId) => {
          setTourOn(false);
          focus(bodyId);
        }}
      />

      <BodyDetailModal
        body={detailBodyId ? BODIES.find((b) => b.id === detailBodyId) ?? null : null}
        onClose={() => setDetailBodyId(null)}
        positions={positions}
      />
    </div>
  );
}
