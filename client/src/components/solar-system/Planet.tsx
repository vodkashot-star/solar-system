import { useRef, useMemo, Suspense, useCallback, useState, useEffect, useLayoutEffect, Component } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Body } from "./bodies";
import { startLoad, finishLoad, failLoad } from "@/lib/load-debugger";
import { useCameraFocus } from "@/stores/camera-focus";
import { useCinematicMode } from "@/stores/cinematic-mode";
import AtmosphereGlow from "./AtmosphereGlow";
import { applyProceduralMaterials, getCachedDiffuse, getCachedNormal, getCachedRoughness } from "@/lib/procedural-textures";
import { getHeliocentricPosition, ASTRONOMY_BODIES } from "@/lib/astronomy-positions";

type PlanetProps = {
  body: Body;
  onPosition?: (pos: THREE.Vector3) => void;
  scaleMultiplier?: number;
  onComputedRadius?: (bodyId: string, radius: number) => void;
  onHover?: (bodyId: string | null) => void;
  speedMultiplier?: number;
};

function solveKeplerElliptic(M: number, e: number): number {
  let E = M;
  for (let i = 0; i < 12; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-8) break;
  }
  return E;
}

function solveKeplerHyperbolic(M: number, e: number): number {
  let H = M;
  for (let i = 0; i < 20; i++) {
    const dH = (M - e * Math.sinh(H) + H) / (e * Math.cosh(H) - 1);
    H += dH;
    if (Math.abs(dH) < 1e-8) break;
  }
  return H;
}

function solveKepler(M: number, e: number): number {
  if (e < 1e-6) return M;
  if (e > 1) return solveKeplerHyperbolic(M, e);
  return solveKeplerElliptic(M, e);
}

const ATMOSPHERE_BODIES = new Set(["earth", "venus", "mars", "jupiter", "saturn", "neptune"]);

const FALLBACK_GEOMETRY = new THREE.SphereGeometry(1, 48, 48);

// Cache per-body fallback materials to avoid cloning on every render
const materialCache = new Map<string, THREE.MeshStandardMaterial>();
function getFallbackMaterial(color: string, emissive: boolean) {
  const key = `${color}:${emissive}`;
  if (!materialCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.05,
      color,
      emissive: emissive ? new THREE.Color(color) : new THREE.Color("#000000"),
      emissiveIntensity: emissive ? 1.4 : 0,
    });
    materialCache.set(key, m);
  }
  return materialCache.get(key)!;
}

function GLBModel({ url, radius, body, onReady }: {
  url: string; radius: number; body: Body; onReady?: () => void;
}) {
  // Register the load attempt exactly once BEFORE useGLTF so that if the hook
  // throws/suspends on a missing file the body is still in the tracker and the
  // error boundary's failLoad call can update its status.
  const registeredRef = useRef(false);
  if (!registeredRef.current) {
    registeredRef.current = true;
    startLoad(body.id, body.name, url);
  }

  const { scene } = useGLTF(url);

  useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = (radius * 2) / maxDim;
    scene.scale.setScalar(scale);

    box.setFromObject(scene);
    const center = new THREE.Vector3();
    box.getCenter(center);
    scene.position.sub(center);

    if (body.type === "dwarfPlanet" || body.type === "asteroid" || body.type === "comet" || body.type === "interstellar") {
      applyProceduralMaterials(scene, body.id, body.type);
    }

    scene.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.frustumCulled = true;
        mesh.geometry?.computeBoundingSphere();
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
      }
    });
    scene.matrixAutoUpdate = false;
    scene.updateMatrix();
    finishLoad(body.id);
  }, [scene, radius, body.id, body.type]);

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return <primitive object={scene} />;
}

class GLBLoadErrorBoundary extends Component<
  { bodyId: string; bodyName: string; fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean; retryKey: number }
> {
  state = { hasError: false, retryKey: 0 };
  retryTimer: ReturnType<typeof setTimeout> | null = null;
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) {
    // Ensure the body is registered in the tracker even if startLoad was never
    // reached (e.g. the GLB fetch failed before the hook could run).
    startLoad(this.props.bodyId, this.props.bodyName, "");
    failLoad(this.props.bodyId, error.message);
    this.retryTimer = setTimeout(() => {
      this.setState({ hasError: false, retryKey: this.state.retryKey + 1 });
    }, 3000);
  }
  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}

function FallbackSphere({ radius, color, emissive, bodyId, bodyType }: {
  radius: number; color: string; emissive?: boolean; bodyId: string; bodyType: string;
}) {
  const mat = useMemo(() => {
    if (emissive) return getFallbackMaterial(color, true);
    // Use the shared cache for non-emissive too — key by bodyId+bodyType so
    // per-body procedural textures are still unique but materials aren't leaked
    const key = `fallback:${bodyId}:${bodyType}:${color}`;
    if (!materialCache.has(key)) {
      const m = new THREE.MeshStandardMaterial({
        roughness: 0.7,
        metalness: 0.1,
        map: getCachedDiffuse(bodyId, bodyType),
        normalMap: getCachedNormal(bodyId, bodyType),
        normalScale: new THREE.Vector2(1.5, 1.5),
        roughnessMap: getCachedRoughness(bodyId, bodyType),
        color: new THREE.Color(color),
      });
      materialCache.set(key, m);
    }
    return materialCache.get(key)!;
  }, [color, emissive, bodyId, bodyType]);
  return (
    <mesh geometry={FALLBACK_GEOMETRY} scale={radius}>
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

const RING_GEOMETRY = new THREE.RingGeometry(2.4, 3.8, 64);
const ringMaterial = new THREE.MeshBasicMaterial({
  color: "#c8b88a",
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.6,
  depthWrite: false,
});

function SaturnRings({ radius }: { radius: number }) {
  return (
    <mesh
      rotation={[-Math.PI / 2.4, 0, 0]}
      scale={radius * 1.2}
      geometry={RING_GEOMETRY}
      material={ringMaterial}
      frustumCulled={false}
    />
  );
}

export default function Planet({ body, onPosition, scaleMultiplier = 1, onComputedRadius, onHover, speedMultiplier = 1 }: PlanetProps) {
  const pivot = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const focus = useCameraFocus((s) => s.focus);
  const [glbReady, setGlbReady] = useState(false);

  const effectiveOrbit = body.orbit * scaleMultiplier;
  const effectiveRadius = body.visualRadius * (0.3 + 0.7 * scaleMultiplier);
  const isStationary = body.orbitSpeed === 0;
  const e = body.properties.eccentricity;
  const inclRad = body.properties.inclination * Math.PI / 180;
  const sqrt1me2 = Math.sqrt(Math.max(0, 1 - e * e));

  const cinematic = useCinematicMode((s) => s.enabled);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const p = pivot.current?.position;
      if (p) focus(body.id);
    },
    [body.id, focus],
  );

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover?.(body.id);
    },
    [body.id, onHover],
  );

  const handlePointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover?.(null);
    },
    [onHover],
  );

  useFrame((state, delta) => {
    const p = pivot.current;
    if (p) {
      if (!isStationary) {
        if (ASTRONOMY_BODIES.has(body.id)) {
          const pos = getHeliocentricPosition(body.id, state.clock.elapsedTime, speedMultiplier, effectiveOrbit);
          if (pos) {
            p.position.set(pos.x, pos.y, pos.z);
          }
        } else {
          const M = body.phase + state.clock.elapsedTime * body.orbitSpeed * speedMultiplier;
          const E = solveKepler(M, e);
          const xOrb = effectiveOrbit * (e > 1 ? (e - Math.cosh(E)) : (Math.cos(E) - e));
          const zOrb = effectiveOrbit * (e > 1
            ? Math.sqrt(e * e - 1) * Math.sinh(E)
            : sqrt1me2 * Math.sin(E));
          p.position.x = xOrb;
          p.position.y = zOrb * Math.sin(inclRad);
          p.position.z = zOrb * Math.cos(inclRad);
        }
      }
      if (cinematic) {
        const bobAmplitude = 0.15 + effectiveRadius * 0.1;
        const bobFrequency = 0.6 + body.visualRadius * 0.08;
        p.position.y += Math.sin(state.clock.elapsedTime * bobFrequency + body.phase) * bobAmplitude;
      }
      if (onPosition) onPosition(p.position);
    }
    if (spin.current) {
      spin.current.rotation.y += body.spinSpeed * delta * speedMultiplier;
    }
    // Skip re-render when paused (speed=0) and not in cinematic tour — nothing
    // is moving so there's no need to invalidate the frame each tick.
    if (speedMultiplier > 0 || cinematic) {
      state.invalidate();
    }
  });

  useLayoutEffect(() => {
    if (spin.current && glbReady) {
      const box = new THREE.Box3().setFromObject(spin.current);
      const size = new THREE.Vector3();
      box.getSize(size);
      const r = Math.max(size.x, size.y, size.z) / 2;
      if (r > 0.01) onComputedRadius?.(body.id, r);
    }
  }, [glbReady, body.id, onComputedRadius, scaleMultiplier]);

  useEffect(() => {
    if (!body.glbUrl) onComputedRadius?.(body.id, effectiveRadius);
  }, [body.glbUrl, body.id, onComputedRadius, effectiveRadius]);

  const isSun = body.id === "sun";
  const hasAtmosphere = ATMOSPHERE_BODIES.has(body.id) && !isSun;

  return (
    <group ref={pivot}>
      <group ref={spin} rotation={[0, 0, body.tilt]}>
        <Suspense fallback={<FallbackSphere radius={effectiveRadius} color={body.color} emissive={isSun} bodyId={body.id} bodyType={body.type} />}>
          {body.glbUrl ? (
            <GLBLoadErrorBoundary bodyId={body.id} bodyName={body.name} fallback={
              <group onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
                <FallbackSphere radius={effectiveRadius} color={body.color} emissive={isSun} bodyId={body.id} bodyType={body.type} />
              </group>
            }>
              <group onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
                <GLBModel url={body.glbUrl} radius={effectiveRadius} body={body} onReady={() => setGlbReady(true)} />
              </group>
            </GLBLoadErrorBoundary>
          ) : (
            <group onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
              <FallbackSphere radius={effectiveRadius} color={body.color} emissive={isSun} bodyId={body.id} bodyType={body.type} />
            </group>
          )}
        </Suspense>
        {hasAtmosphere && <AtmosphereGlow radius={effectiveRadius} bodyId={body.id} />}
        {body.hasRings && <SaturnRings radius={effectiveRadius} />}
      </group>
    </group>
  );
}
