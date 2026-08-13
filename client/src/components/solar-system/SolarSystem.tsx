import { useRef, useState, useMemo, useCallback, useEffect, lazy, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { BODIES, type Body } from "./bodies";
import { useCustomBodies } from "@/hooks/useCustomBodies";
import { isCustomBodyId } from "@/lib/custom-bodies";
import Planet from "./Planet";
import OrbitRings from "./OrbitRings";
import InstancedStars from "./InstancedStars";
import NebulaBackground from "./NebulaBackground";
import CinematicTour from "./CinematicTour";
import FocusCamera from "./FocusCamera";
import SunGlow from "./SunGlow";
import LoadingSpinner from "./LoadingSpinner";
import DebugPanel from "./DebugPanel";
import PerformanceMonitor from "./PerformanceMonitor";
import PerformanceMetricsProbe from "./PerformanceMetricsProbe";
import AdaptiveQuality from "./AdaptiveQuality";
import AIClassificationPanel from "./AIClassificationPanel";
import ScaleControl, { type ScaleMode } from "./ScaleControl";
import BodySearch from "./BodySearch";
import KeyboardShortcutsModal from "./KeyboardShortcutsModal";
import FilmGrainOverlay from "./FilmGrainOverlay";
import { useCameraFocus } from "@/stores/camera-focus";
import { useCinematicMode } from "@/stores/cinematic-mode";
import { useSimulation } from "@/stores/simulation";
import OrbitalBody from "./OrbitalBody";
import { useAIClassification } from "@/hooks/useAIClassification";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";

// Lazy load heavy modal components to reduce initial bundle size
const BodyDetailModal = lazy(() => import("./BodyDetailModal"));
const CustomBodyModal = lazy(() => import("./CustomBodyModal"));

// ── Scale multipliers for each view mode ─────────────────────────────────────
const SCALE_VISUAL          = 1;
const SCALE_HYBRID          = 0.6;
const SCALE_REAL_SIZE       = 0.35;
const SCALE_REAL_DISTANCE   = 0.25;

// ── Camera clipping planes ────────────────────────────────────────────────────
/** Near clip — small enough to avoid z-fighting at close approach. */
const CAMERA_NEAR            = 0.01;
/** Far clip used when scale is compressed (hybrid / realSize / realDistance). */
const CAMERA_FAR_COMPRESSED  = 400;
/** Far clip used for visual scale where orbits extend furthest. */
const CAMERA_FAR_EXPANDED    = 1500;

export default function SolarSystem() {
  const [tourOn, setTourOn] = useState(true);
  const [overview, setOverview] = useState(false);
  const [active, setActive] = useState<Body>(BODIES[0]);
  const [scaleMode, setScaleMode] = useState<ScaleMode>("visual");
  const [contextLost, setContextLost] = useState(false);
  const [hoveredBodyId, setHoveredBodyId] = useState<string | null>(null);
  const [detailBodyId, setDetailBodyId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [customBodyOpen, setCustomBodyOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const positions = useRef<Record<string, THREE.Vector3>>({});
  const computedRadii = useRef<Record<string, number>>({});
  const clearFocus = useCameraFocus((s) => s.clear);
  const focus = useCameraFocus((s) => s.focus);
  const fitAll = useCameraFocus((s) => s.fitAll);
  const fit = useCameraFocus((s) => s.fit);
  const isFocused = useCameraFocus((s) => s.isFocused);
  const focusTarget = useCameraFocus((s) => s.targetBodyId);
  const setCinematic = useCinematicMode((s) => s.setEnabled);

  // User-created bodies from the catalog API (empty when offline). Merged with
  // the static catalog so custom bodies flow through every part of the scene.
  const { customBodies, remove: removeCustomBody } = useCustomBodies();
  const allBodies = useMemo(() => [...BODIES, ...customBodies], [customBodies]);

  // Bodies that need their real GLB mounted right now: the tour/focus target,
  // hovered body, and the body in the detail modal. Everything else renders the
  // cheap procedural sphere until it becomes wanted (lazy GLB loading).
  const wantedIds = useMemo(() => {
    const ids = new Set<string>();
    if (tourOn && active) ids.add(active.id);
    if (isFocused && focusTarget) ids.add(focusTarget);
    if (hoveredBodyId) ids.add(hoveredBodyId);
    if (detailBodyId) ids.add(detailBodyId);
    return ids;
  }, [tourOn, active, isFocused, focusTarget, hoveredBodyId, detailBodyId]);

  // Prefetch the next few tour bodies in idle time so the tour never stalls
  // on a model download (useGLTF cache makes revisits instant).
  useEffect(() => {
    if (!tourOn || !active) return;
    const idx = allBodies.findIndex((b) => b.id === active.id);
    if (idx < 0) return;
    const urls: string[] = [];
    for (let i = 1; i <= 3 && urls.length < 3; i++) {
      const b = allBodies[(idx + i) % allBodies.length];
      if (b.glbUrl) urls.push(b.glbUrl);
    }
    const prefetch = () => urls.forEach((u) => useGLTF.preload(u));
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(prefetch, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(prefetch, 500);
    return () => window.clearTimeout(t);
  }, [tourOn, active, allBodies]);

  // AI classification data for all bodies.
  const aiCache = useAIClassification(active);

  useEffect(() => {
    if (isFocused || fitAll) setOverview(false);
  }, [isFocused, fitAll]);

  useEffect(() => {
    setCinematic(tourOn);
  }, [tourOn, setCinematic]);

  // Mirror the speed slider into the simulation store so Canvas children can
  // skip invalidate() when paused (true freeze under frameloop="demand").
  const setSimSpeed = useSimulation((s) => s.setSpeed);
  useEffect(() => {
    setSimSpeed(speedMultiplier);
  }, [speedMultiplier, setSimSpeed]);

  const currentIndex = allBodies.findIndex((b) => b.id === active.id);

  useKeyboardNavigation({
    bodies: allBodies,
    currentIndex,
    detailOpen: detailBodyId !== null,
    searchOpen,
    shortcutsOpen,
    onToggleTour: () => {
      setTourOn((v) => {
        if (!v) clearFocus();
        return !v;
      });
    },
    onPrevBody: (bodyId) => {
      setTourOn(false);
      focus(bodyId);
    },
    onNextBody: (bodyId) => {
      setTourOn(false);
      focus(bodyId);
    },
    onClearFocus: clearFocus,
    onCloseDetail: () => setDetailBodyId(null),
    onOpenSearch: () => setSearchOpen(true),
    onCloseSearch: () => setSearchOpen(false),
    onOpenShortcuts: () => setShortcutsOpen(true),
  });

  const scaleMultiplier =
    scaleMode === "visual"       ? SCALE_VISUAL        :
    scaleMode === "hybrid"       ? SCALE_HYBRID        :
    scaleMode === "realSize"     ? SCALE_REAL_SIZE     :
    SCALE_REAL_DISTANCE;

  const nearPlane = CAMERA_NEAR;
  const farPlane = scaleMultiplier < SCALE_HYBRID ? CAMERA_FAR_COMPRESSED : CAMERA_FAR_EXPANDED;

  const reportPosCallbacks = useMemo(() => {
    const map: Record<string, (p: THREE.Vector3) => void> = {};
    for (const b of allBodies) {
      map[b.id] = (p: THREE.Vector3) => {
        if (!positions.current[b.id]) positions.current[b.id] = new THREE.Vector3();
        positions.current[b.id].copy(p);
      };
    }
    return map;
  }, [allBodies]);

  const reportComputedRadius = useCallback((bodyId: string, radius: number) => {
    computedRadii.current[bodyId] = radius;
  }, []);

  const handleHover = useCallback((bodyId: string | null) => {
    setHoveredBodyId(bodyId);
  }, []);

  // Groupings — rebuilt when custom bodies arrive so the arrays stay in sync.
  // Spacecraft with a parentBody must appear ONLY in the spacecraft list
  // (they get an orbitRadius override); otherwise they'd render twice.
  const { primaryBodies, moons, spacecraft } = useMemo(() => ({
    primaryBodies: allBodies.filter((b) => b.type !== "spacecraft" && !b.parentBody),
    moons: allBodies.filter((b) => b.parentBody && b.type !== "spacecraft"),
    spacecraft: allBodies.filter((b) => b.type === "spacecraft"),
  }), [allBodies]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <div className="absolute inset-0" style={{ zIndex: 0, isolation: "isolate" }}>
        <Canvas
          camera={{ position: [0, 55, 130], fov: 55, near: nearPlane, far: farPlane }}
          dpr={[1, 1.75]}
          gl={{ powerPreference: "high-performance", logarithmicDepthBuffer: scaleMultiplier < 0.5, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
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
          <ambientLight intensity={0.28} />
          {/* Warm sun light — orbital falloff keeps the inner system golden. */}
          <pointLight position={[0, 0, 0]} intensity={3.5} distance={200} decay={1.0} color="#ffd9a0" />
          {/* Distance-independent fill so every planet reads its texture no
              matter where it sits in its orbit (pointLights dim with 1/r). */}
          <directionalLight position={[0, 30, 20]} intensity={0.85} color="#cdd6ff" />
          <directionalLight position={[-25, -10, -15]} intensity={0.25} color="#7a6fb0" />

          <NebulaBackground />
          {/* Second dust band, tilted across the sky — same cached texture,
              zero extra generation cost, adds galactic depth. */}
          <NebulaBackground rotation={[0.32, 0.55, 0]} opacity={0.13} radius={400} />
          <InstancedStars radius={200} depth={80} count={6000} factor={4} fade />

          <SunGlow />

          <OrbitRings scaleMultiplier={scaleMultiplier} bodies={allBodies} dimmed={overview || fitAll} activeId={tourOn ? active?.id : focusTarget} />

          {/* Planets and dwarf planets (no parentBody) */}
          {primaryBodies.map((b) => (
            <Planet key={b.id} body={b} onPosition={reportPosCallbacks[b.id]} scaleMultiplier={scaleMultiplier} onComputedRadius={reportComputedRadius} onHover={handleHover} speedMultiplier={speedMultiplier} isWanted={wantedIds.has(b.id)} />
          ))}

          {/* Moons and spacecraft (have parentBody) — moons use their astronomical
              orbit params, spacecraft get an orbitRadius override */}
          {moons.map((b) => (
            <OrbitalBody
              key={b.id}
              body={b}
              parentPositionRef={positions}
              onPosition={reportPosCallbacks[b.id]}
              scaleMultiplier={scaleMultiplier}
              onComputedRadius={reportComputedRadius}
              onHover={handleHover}
              speedMultiplier={speedMultiplier}
              isWanted={wantedIds.has(b.id)}
            />
          ))}

          {spacecraft.map((b) => (
            <OrbitalBody
              key={b.id}
              body={b}
              parentPositionRef={positions}
              orbitRadius={b.parentBody ? (computedRadii.current[b.parentBody] ?? 1.5) * 2.2 : b.orbit}
              onPosition={reportPosCallbacks[b.id]}
              scaleMultiplier={scaleMultiplier}
              onComputedRadius={reportComputedRadius}
              onHover={handleHover}
              speedMultiplier={speedMultiplier}
              isWanted={wantedIds.has(b.id)}
            />
          ))}

          <FocusCamera positions={positions} computedRadii={computedRadii} bodies={allBodies} />
          <CinematicTour enabled={tourOn} onActiveChange={setActive} onOverviewChange={setOverview} positions={positions} computedRadii={computedRadii} speedMultiplier={speedMultiplier} bodies={allBodies} />
          <PerformanceMetricsProbe />
          <AdaptiveQuality />

          {!tourOn && !fitAll && (
            <OrbitControls
              enableDamping
              dampingFactor={0.15}
              minDistance={2}
              maxDistance={200}
              zoomSpeed={0.8}
              rotateSpeed={0.6}
            />
          )}

          {(tourOn || isFocused) && (
            <EffectComposer>
              <Bloom intensity={tourOn ? 0.9 : 0} luminanceThreshold={0.6} luminanceSmoothing={0.2} mipmapBlur />
            </EffectComposer>
          )}
        </Canvas>
      </div>

      {contextLost && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="mb-4 h-12 w-12 rounded-full border-2 border-amber-500/60 border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-white/80">Graphics rendering lost</p>
          <p className="mt-1 text-xs text-white/40">Recovering...</p>
          <button
            onClick={() => window.location.reload()}
            aria-label="Reload page to recover WebGL context"
            className="mt-6 rounded-lg border border-white/20 bg-white/5 px-6 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10"
          >
            Reload page
          </button>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-2 pt-[max(env(safe-area-inset-top),0.5rem)] sm:p-4 sm:pt-[max(env(safe-area-inset-top),1rem)]">
        <div className="flex items-start justify-between gap-2">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            <h1 className="hidden text-xs font-semibold tracking-[0.2em] text-white/80 uppercase xs:inline sm:text-sm">
              Solar System
            </h1>
            <button
              onClick={() => setSearchOpen(true)}
              className="min-h-[44px] min-w-[44px] rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-medium text-white/60 backdrop-blur-md transition-all duration-200 hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95 sm:text-xs"
              aria-label="Search bodies (press /)"
              title="Search bodies (/)"
            >
              <span className="hidden xs:inline">Search</span>
              <span className="xs:hidden">🔍</span>
            </button>
            <button
              onClick={() => setCustomBodyOpen(true)}
              className="min-h-[44px] min-w-[44px] rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-medium text-white/60 backdrop-blur-md transition-all duration-200 hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95 sm:text-xs"
              aria-label="Add a custom celestial body"
              title="Add a custom body"
            >
              <span className="hidden xs:inline">+ Add</span>
              <span className="xs:hidden">+</span>
            </button>
            <button
              onClick={() => setShortcutsOpen(true)}
              className="min-h-[44px] min-w-[44px] rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-medium text-white/60 backdrop-blur-md transition-all duration-200 hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95 sm:text-xs"
              aria-label="Show keyboard shortcuts (?)"
              title="Keyboard shortcuts (?)"
            >
              ?
            </button>
          </div>
          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
            <ScaleControl currentMode={scaleMode} onModeChange={setScaleMode} compact />
            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 backdrop-blur-md">
              <span className="hidden text-[10px] text-white/50 sm:inline">Speed</span>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={speedMultiplier}
                onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
                aria-label="Simulation speed"
                className="h-6 w-12 cursor-pointer appearance-none rounded-full bg-white/20 accent-white sm:h-2 sm:w-16"
                style={{
                  WebkitAppearance: 'none',
                  background: `linear-gradient(to right, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.3) ${(speedMultiplier / 5) * 100}%, rgba(255,255,255,0.2) ${(speedMultiplier / 5) * 100}%, rgba(255,255,255,0.2) 100%)`
                }}
              />
              <span className="min-w-[24px] text-right text-[9px] font-medium text-white/70 sm:text-[10px]">{speedMultiplier.toFixed(1)}x</span>
            </div>
            <button
              onClick={() => {
                setTourOn(false);
                clearFocus();
                fit();
              }}
              aria-label="Frame all celestial bodies on screen"
              title="Fit all bodies"
              className="min-h-[44px] rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[10px] font-medium text-white/90 backdrop-blur-md transition-all duration-200 hover:bg-white/10 hover:scale-105 active:scale-95 sm:text-xs"
            >
              <span className="hidden xs:inline">Fit All</span>
              <span className="xs:hidden">⊡</span>
            </button>
            <button
              onClick={() => {
                setTourOn((v) => {
                  if (!v) clearFocus();
                  return !v;
                });
              }}
              aria-label={tourOn ? "Pause cinematic tour" : "Start cinematic tour"}
              className="min-h-[44px] rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[10px] font-medium text-white/90 backdrop-blur-md transition-all duration-200 hover:bg-white/10 hover:scale-105 active:scale-95 sm:text-xs"
            >
              {tourOn ? "⏸" : "▶"} <span className="hidden xs:inline">{tourOn ? " Pause" : " Tour"}</span>
            </button>
          </div>
        </div>
      </div>

      <div
        key={overview || fitAll ? "overview" : active.id}
        className="pointer-events-none absolute bottom-2 left-2 right-2 z-20 animate-fade-in sm:bottom-6 sm:left-8 sm:right-auto sm:max-w-xs pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:pb-[max(env(safe-area-inset-bottom),1.5rem)]"
      >
        {overview || fitAll ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-lg shadow-2xl sm:p-4">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
              Now viewing
            </div>
            <div className="mt-0.5 text-base font-light text-white sm:text-xl">Solar System</div>
            <p className="mt-2 text-[11px] leading-relaxed text-white/60 sm:text-xs">
              Our cosmic neighborhood — eight planets, five dwarf planets, hundreds of moons,
              and countless asteroids orbit a single yellow dwarf star.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-lg shadow-2xl sm:p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
                  {tourOn || isFocused ? "Now viewing" : "Last viewed"}
                </div>
                <div className="mt-0.5 truncate text-base font-light text-white sm:text-xl">{active.name}</div>
              </div>
              <button
                onClick={() => setDetailBodyId(active.id)}
                aria-label={`View details for ${active.name}`}
                className="pointer-events-auto shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-medium text-white/70 backdrop-blur-sm transition-all duration-200 hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95 sm:text-xs"
              >
                Details
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-white/60 sm:text-xs">{active.fact}</p>

            {aiCache[active.id] && (
              <div className="mt-3 border-t border-white/10 pt-3 sm:mt-3 sm:pt-3">
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
      <PerformanceMonitor />
      <FilmGrainOverlay />

      {hoveredBodyId && (() => {
        const body = allBodies.find((b) => b.id === hoveredBodyId);
        if (!body) return null;
        return (
          <div className="pointer-events-none fixed left-1/2 z-40 -translate-x-1/2 animate-fade-in rounded-xl border border-white/15 bg-black/90 px-4 py-2 backdrop-blur-xl shadow-2xl top-20 sm:top-auto sm:bottom-20">
            <div className="text-sm font-medium text-white">{body.name}</div>
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
        bodies={allBodies}
      />

      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Lazy-loaded modals with Suspense fallback */}
      <Suspense fallback={null}>
        <BodyDetailModal
          body={detailBodyId ? allBodies.find((b) => b.id === detailBodyId) ?? null : null}
          onClose={() => setDetailBodyId(null)}
          positions={positions}
          onDeleteCustom={isCustomBodyId(detailBodyId ?? "") ? removeCustomBody : undefined}
        />
      </Suspense>

      <Suspense fallback={null}>
        <CustomBodyModal
          open={customBodyOpen}
          onClose={() => setCustomBodyOpen(false)}
          onCreated={(bodyId) => {
            setTourOn(false);
            focus(bodyId);
          }}
        />
      </Suspense>
    </div>
  );
}
