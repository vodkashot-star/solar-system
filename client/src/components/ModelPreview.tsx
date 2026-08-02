import { useEffect, useMemo, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, OrbitControls, Grid, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { BODIES } from "./solar-system/bodies";
import { initDracoDecoder } from "@/lib/draco-setup";

/** Models are normalized to this max dimension so small bodies frame nicely. */
const MAX_FIT = 1.5;

type GLBStats = { meshes: number; triangles: number; textures: number };

function computeGLBStats(scene: THREE.Group): GLBStats {
  let meshes = 0;
  let triangles = 0;
  let textures = 0;
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes += 1;
    const geo = mesh.geometry;
    if (geo) {
      const index = geo.index;
      const position = geo.getAttribute("position");
      const count = index ? index.count : position ? position.count / 3 : 0;
      if (Number.isFinite(count)) triangles += Math.round(count);
    }
    const materialList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materialList) {
      const m = material as THREE.MeshStandardMaterial;
      if (m.map) textures += 1;
      if (m.normalMap) textures += 1;
      if (m.metalnessMap) textures += 1;
      if (m.roughnessMap) textures += 1;
      if (m.emissiveMap) textures += 1;
    }
  });
  return { meshes, triangles, textures };
}

function NormalizedModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);

  // Normalize once per model: scale to a consistent size and recentre on the
  // bounding box so every body (rock, spacecraft, planet) frames the same way.
  useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    scene.scale.setScalar(MAX_FIT / maxDim);

    box.setFromObject(scene);
    const center = new THREE.Vector3();
    box.getCenter(center);
    scene.position.sub(center);
    scene.updateMatrixWorld(true);
  }, [scene]);

  return (
    <group>
      <primitive object={scene} />
      <ContactShadows position={[0, -MAX_FIT / 2 - 0.02, 0]} opacity={0.65} scale={10} blur={2.2} far={4} resolution={512} color="#000000" />
    </group>
  );
}

function PreviewScene({ url, onStats }: { url: string; onStats: (s: GLBStats) => void }) {
  const { scene } = useGLTF(url);
  const stats = useMemo(() => computeGLBStats(scene), [scene]);
  useEffect(() => {
    onStats(stats);
  }, [stats, onStats]);

  return (
    <>
      <color attach="background" args={["#06060c"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 8, 4]} intensity={1.4} />
      <directionalLight position={[-6, 2, -5]} intensity={0.35} color="#7aa2ff" />

      <Suspense fallback={null}>
        <NormalizedModel url={url} />
      </Suspense>

      <Grid
        position={[0, -MAX_FIT / 2, 0]}
        args={[10, 10]}
        cellSize={0.25}
        cellThickness={0.5}
        sectionSize={2}
        sectionColor="#3b3f5c"
        cellColor="#1b1e30"
        fadeDistance={8}
        fadeStrength={1.5}
        infiniteGrid
      />

      <OrbitControls makeDefault autoRotate autoRotateSpeed={1.4} minDistance={0.3} maxDistance={12} />
    </>
  );
}

export default function ModelPreview({ id }: { id?: string }) {
  const modelBodies = useMemo(() => BODIES.filter((b) => b.glbUrl), []);
  const initialId = useMemo(() => {
    if (id && modelBodies.some((b) => b.id === id)) return id;
    return modelBodies[0]?.id ?? null;
  }, [id, modelBodies]);

  const [bodyId, setBodyId] = useState<string | null>(initialId);
  const body = useMemo(() => modelBodies.find((b) => b.id === bodyId) ?? null, [bodyId, modelBodies]);
  const [stats, setStats] = useState<GLBStats | null>(null);
  const reportStats = useMemo(() => setStats, []);

  useEffect(() => {
    initDracoDecoder();
  }, []);

  const selectBody = (nextId: string) => {
    setBodyId(nextId);
    const next = new URL(window.location.href);
    next.searchParams.set("model", nextId);
    window.history.replaceState(null, "", `${next.pathname}${next.search}`);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#06060c] text-white">
      <Canvas dpr={[1, 1.75]} gl={{ powerPreference: "high-performance", antialias: true }}>
        {body && <PreviewScene url={body.glbUrl!} onStats={reportStats} />}
      </Canvas>

      {/* Header / studio controls */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="pointer-events-auto flex flex-col gap-1 rounded-xl border border-white/10 bg-black/60 px-4 py-3 backdrop-blur-md">
          <label className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">
            GLB Studio
          </label>
          <div className="flex items-center gap-2">
            <a
              href={window.location.pathname}
              className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              &larr; Back to tour
            </a>
            <select
              value={body?.id ?? ""}
              onChange={(e) => selectBody(e.target.value)}
              aria-label="Select model to preview"
              className="max-w-[220px] rounded-lg border border-white/15 bg-black/70 px-2.5 py-1.5 text-xs text-white/90 outline-none focus:border-white/30"
            >
              {modelBodies.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {body && (
          <div className="pointer-events-auto hidden rounded-xl border border-white/10 bg-black/60 px-4 py-3 font-mono text-[11px] text-white/60 backdrop-blur-md sm:block">
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">
              {body.type.replace(/([A-Z])/g, " $1").trim()}
            </div>
            <div className="mt-0.5 text-sm font-medium text-white">{body.name}</div>
            <div className="mt-1 truncate text-[10px] text-white/35" title={body.glbUrl}>
              {body.glbUrl?.replace("/models/", "")}
            </div>
            {stats && (
              <div className="mt-1.5 flex gap-2 border-t border-white/10 pt-1.5 text-[10px] text-white/45">
                <span>{stats.triangles.toLocaleString()} tris</span>
                <span>/</span>
                <span>{stats.meshes} meshes</span>
                <span>/</span>
                <span>{stats.textures} textures</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hint bar */}
      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-black/60 px-4 py-1.5 font-mono text-[10px] text-white/50 backdrop-blur-md">
        <span>{body?.name ?? "No model"}</span>
        <span className="text-white/25">•</span>
        <span>Drag to orbit</span>
        <span className="text-white/25">•</span>
        <span>Scroll to zoom</span>
      </div>
    </div>
  );
}