import { useRef, useMemo, Suspense, useCallback, useState, useEffect, useLayoutEffect } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Body } from "./bodies";
import { startLoad, finishLoad } from "@/lib/load-debugger";
import { useCameraFocus } from "@/stores/camera-focus";

type PlanetProps = {
  body: Body;
  onPosition?: (pos: THREE.Vector3) => void;
  scaleMultiplier?: number;
  onComputedRadius?: (bodyId: string, radius: number) => void;
  onHover?: (bodyId: string | null) => void;
};

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
  const { scene } = useGLTF(url);

  // Bug fix: normalize the scene in-place rather than cloning — avoids
  // duplicating geometry buffers and the old-clone-never-disposed memory leak.
  // Bug fix: apply scale then update matrix AFTER position centering.
  useMemo(() => {
    startLoad(body.id, body.name, url);
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = (radius * 2) / maxDim;
    scene.scale.setScalar(scale);

    // Re-compute box after scale to get accurate center
    box.setFromObject(scene);
    const center = new THREE.Vector3();
    box.getCenter(center);
    scene.position.sub(center);

    scene.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.frustumCulled = true;
        mesh.geometry?.computeBoundingSphere();
        // updateMatrix AFTER all position/scale changes are done
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
      }
    });
    // Update root matrix too so centering offset is captured
    scene.matrixAutoUpdate = false;
    scene.updateMatrix();
    finishLoad(body.id);
  }, [scene, radius]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return <primitive object={scene} />;
}

function FallbackSphere({ radius, color, emissive }: { radius: number; color: string; emissive?: boolean }) {
  const mat = getFallbackMaterial(color, !!emissive);
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

export default function Planet({ body, onPosition, scaleMultiplier = 1, onComputedRadius, onHover }: PlanetProps) {
  const pivot = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const focus = useCameraFocus((s) => s.focus);
  const [glbReady, setGlbReady] = useState(false);

  const effectiveOrbit = body.orbit * scaleMultiplier;
  const effectiveRadius = body.visualRadius * (0.3 + 0.7 * scaleMultiplier);
  // Skip orbital math for stationary bodies (sun, interstellar objects)
  const isStationary = body.orbitSpeed === 0;

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const p = pivot.current?.position;
      if (p) focus(body.id, p);
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
        const angle = body.phase + state.clock.elapsedTime * body.orbitSpeed;
        p.position.x = Math.cos(angle) * effectiveOrbit;
        p.position.z = Math.sin(angle) * effectiveOrbit;
      }
      if (onPosition) onPosition(p.position);
    }
    if (spin.current) {
      spin.current.rotation.y += body.spinSpeed * delta;
    }
    state.invalidate();
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

  return (
    <group ref={pivot}>
      <group ref={spin} rotation={[0, 0, body.tilt]}>
        <Suspense fallback={<FallbackSphere radius={effectiveRadius} color={body.color} emissive={isSun} />}>
          {body.glbUrl ? (
            <group onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
              <GLBModel url={body.glbUrl} radius={effectiveRadius} body={body} onReady={() => setGlbReady(true)} />
            </group>
          ) : (
            <group onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
              <FallbackSphere radius={effectiveRadius} color={body.color} emissive={isSun} />
            </group>
          )}
        </Suspense>
        {body.hasRings && <SaturnRings radius={effectiveRadius} />}
      </group>
    </group>
  );
}
