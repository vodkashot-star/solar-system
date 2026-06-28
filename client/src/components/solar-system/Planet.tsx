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
};

const FALLBACK_GEOMETRY = new THREE.SphereGeometry(1, 48, 48);

function GLBModel({ url, radius, body: _body, onReady }: {
  url: string; radius: number; body: Body; onReady?: () => void;
}) {
  startLoad(_body.id, _body.name, url);
  const { scene } = useGLTF(url);
  finishLoad(_body.id);

  const normalized = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = (radius * 2) / maxDim;
    clone.scale.setScalar(scale);
    const center = new THREE.Vector3();
    box.getCenter(center);
    clone.position.sub(center.multiplyScalar(scale));

    clone.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.frustumCulled = true;
        mesh.geometry?.computeBoundingSphere();
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
      }
    });

    return clone;
  }, [scene, radius]);

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return <primitive object={normalized} />;
}

const fallbackMaterial = new THREE.MeshStandardMaterial({
  roughness: 0.85,
  metalness: 0.05,
});

function FallbackSphere({ radius, color, emissive }: { radius: number; color: string; emissive?: boolean }) {
  const mat = useMemo(() => {
    const m = fallbackMaterial.clone();
    m.color.set(color);
    m.emissive = emissive ? new THREE.Color(color) : new THREE.Color("#000000");
    m.emissiveIntensity = emissive ? 1.4 : 0;
    return m;
  }, [color, emissive]);

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
  const scale = radius * 1.2;
  return (
    <mesh
      rotation={[-Math.PI / 2.4, 0, 0]}
      scale={scale}
      geometry={RING_GEOMETRY}
      material={ringMaterial}
      frustumCulled={false}
    />
  );
}

export default function Planet({ body, onPosition, scaleMultiplier = 1, onComputedRadius }: PlanetProps) {
  const pivot = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const focus = useCameraFocus((s) => s.focus);
  const [glbReady, setGlbReady] = useState(false);

  const effectiveOrbit = body.orbit * scaleMultiplier;
  const effectiveRadius = body.visualRadius * (0.3 + 0.7 * scaleMultiplier);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const p = pivot.current?.position;
      if (p) focus(body.id, p);
    },
    [body.id, focus],
  );

  useFrame((state, delta) => {
    const p = pivot.current;
    if (p) {
      const t = state.clock.elapsedTime;
      const angle = body.phase + t * body.orbitSpeed;
      p.position.x = Math.cos(angle) * effectiveOrbit;
      p.position.z = Math.sin(angle) * effectiveOrbit;
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
      if (r > 0.01) {
        onComputedRadius?.(body.id, r);
      }
    }
  }, [glbReady, body.id, onComputedRadius, scaleMultiplier]);

  useEffect(() => {
    if (!body.glbUrl) {
      onComputedRadius?.(body.id, effectiveRadius);
    }
  }, [body.glbUrl, body.id, onComputedRadius, effectiveRadius]);

  const isSun = body.id === "sun";

  return (
    <group ref={pivot}>
      <group ref={spin} rotation={[0, 0, body.tilt]}>
        <Suspense fallback={<FallbackSphere radius={effectiveRadius} color={body.color} emissive={isSun} />}>
          {body.glbUrl ? (
            <group onClick={handleClick}>
              <GLBModel url={body.glbUrl} radius={effectiveRadius} body={body} onReady={() => setGlbReady(true)} />
            </group>
          ) : (
            <group onClick={handleClick}>
              <FallbackSphere radius={effectiveRadius} color={body.color} emissive={isSun} />
            </group>
          )}
        </Suspense>
        {body.hasRings && <SaturnRings radius={effectiveRadius} />}
      </group>
    </group>
  );
}
