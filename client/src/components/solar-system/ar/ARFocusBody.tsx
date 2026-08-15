import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Text, Billboard } from "@react-three/drei";
import { BODIES, type Body } from "../bodies";
import { ORRERY_PLANETS, type OrreryMoon } from "../orrery-data";
import { solveKepler } from "@/lib/kepler";
import { applyProceduralMaterials, getCachedDiffuse, getCachedNormal, getCachedRoughness } from "@/lib/procedural-textures";
import { useAR } from "@/stores/ar";

/** AR radius for a body — planets ~0.12–0.3 m, small bodies clamped small */
function arRadius(body: Body): number {
  return Math.min(0.3, Math.max(0.1, body.visualRadius * 0.18));
}

function FocusGLB({ url, radius, body }: { url: string; radius: number; body: Body }) {
  const { scene } = useGLTF(url);

  useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    scene.scale.setScalar((radius * 2) / maxDim);
    box.setFromObject(scene);
    const center = new THREE.Vector3();
    box.getCenter(center);
    scene.position.sub(center);

    // Rocky bodies whose GLB lacks a real diffuse map get procedural textures
    // (same rule as Planet.tsx); textured NASA models and spacecraft are kept.
    const isRocky = body.type === "dwarfPlanet" || body.type === "asteroid" || body.type === "comet" || body.type === "interstellar";
    if (isRocky) {
      let hasDiffuse = false;
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat && mat.isMaterial && mat.map) hasDiffuse = true;
        }
      });
      if (!hasDiffuse) applyProceduralMaterials(scene, body.id, body.type);
    }
  }, [scene, radius, body]);

  return <primitive object={scene} />;
}

function ProceduralSphere({ body, radius }: { body: Body; radius: number }) {
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({
      map: getCachedDiffuse(body.id, body.type),
      normalMap: getCachedNormal(body.id, body.type),
      roughnessMap: getCachedRoughness(body.id, body.type),
      roughness: 0.85,
      metalness: 0.05,
    }),
    [body],
  );
  return (
    <mesh material={mat}>
      <sphereGeometry args={[radius, 48, 48]} />
    </mesh>
  );
}

function FocusMoon({ moon, body, orbitScale, moonRadius }: {
  moon: OrreryMoon;
  body: Body;
  orbitScale: number;
  moonRadius: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const speed = useAR((s) => s.speed);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: moon.color, roughness: 0.9, metalness: 0.02 }),
    [moon.color],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime * speed;
    const M = (moon.phase ?? 0) + t * moon.orbitSpeed;
    const E = solveKepler(M, moon.eccentricity);
    const sqrt1me2 = Math.sqrt(1 - moon.eccentricity * moon.eccentricity);
    ref.current?.position.set(
      orbitScale * (Math.cos(E) - moon.eccentricity),
      0,
      orbitScale * sqrt1me2 * Math.sin(E),
    );
  });

  const glb = moon.glbUrl ? (
    <Suspense
      fallback={
        <mesh material={mat}>
          <sphereGeometry args={[moonRadius, 24, 24]} />
        </mesh>
      }
    >
      <FocusGLB url={moon.glbUrl} radius={moonRadius} body={{ id: moon.id, type: "dwarfPlanet", name: moon.name } as Body} />
    </Suspense>
  ) : (
    <mesh material={mat}>
      <sphereGeometry args={[moonRadius, 24, 24]} />
    </mesh>
  );
  return <group ref={ref}>{glb}</group>;
}

/**
 * Billboarded 3D-text mission card shown above a focused spacecraft when the
 * "Show Info" overlay is enabled. Rendered as real scene geometry (drei Text)
 * so it works inside the WebXR session — not a DOM overlay.
 */
function MissionInfoOverlay({ body, radius }: { body: Body; radius: number }) {
  const showInfo = useAR((s) => s.showInfoPanels);
  if (!body.missionInfo || !showInfo) return null;

  const info = body.missionInfo;
  const fs = radius * 0.24; // font size scales with the body's AR radius
  const line = fs * 1.35;

  return (
    <Billboard position={[0, radius * 2.3, 0]}>
      <group>
        <Text fontSize={fs} color="#ffffff" anchorX="center" anchorY="top" outlineWidth={fs * 0.06} outlineColor="#000000">
          {body.name}
        </Text>
        <Text position={[0, -line * 1.4, 0]} fontSize={fs * 0.78} color="#c4d6ff" anchorX="center" anchorY="top">
          {info.agency} · Launched {info.launched} · {info.status}
        </Text>
        <Text position={[0, -line * 2.6, 0]} fontSize={fs * 0.78} color="#ffd27a" anchorX="center" anchorY="top">
          Target: {info.target}
        </Text>
        <Text position={[0, -line * 3.8, 0]} fontSize={fs * 0.68} color="#dddddd" maxWidth={radius * 4} lineHeight={1.25} anchorX="center" anchorY="top">
          {info.description}
        </Text>
      </group>
    </Billboard>
  );
}

export function ARFocusBody({ bodyId }: { bodyId: string }) {
  const body = BODIES.find((b) => b.id === bodyId);
  const speed = useAR((s) => s.speed);
  const spinRef = useRef<THREE.Group>(null);

  const { radius, focusK, moons } = useMemo(() => {
    if (!body) return { radius: 0.15, focusK: 1, moons: [] as OrreryMoon[] };
    const radius = arRadius(body);
    const planet = ORRERY_PLANETS.find((p) => p.id === bodyId);
    return {
      radius,
      focusK: planet ? radius / planet.visualRadius : 1,
      moons: planet ? planet.moons : [],
    };
  }, [body, bodyId]);

  useFrame((_, dt) => {
    if (body && spinRef.current) {
      spinRef.current.rotation.y += dt * body.spinSpeed * 1.5 * speed;
    }
  });

  if (!body) return null;

  return (
    <group>
      <group ref={spinRef}>
        {body.glbUrl ? (
          <Suspense fallback={<ProceduralSphere body={body} radius={radius} />}>
            <FocusGLB url={body.glbUrl} radius={radius} body={body} />
          </Suspense>
        ) : (
          <ProceduralSphere body={body} radius={radius} />
        )}
        {body.hasRings && (
          <mesh rotation={[-Math.PI / 2, 0, body.tilt]} position={[0, 0, 0]}>
            <ringGeometry args={[radius * 1.4, radius * 2.4, 64]} />
            <meshBasicMaterial color="#e3d5ae" transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}
      </group>

      {moons.map((m) => (
        <FocusMoon
          key={m.id}
          moon={m}
          body={body}
          orbitScale={m.orbitRadius * focusK}
          moonRadius={m.visualRadius * focusK}
        />
      ))}

      {body.missionInfo && <MissionInfoOverlay body={body} radius={radius} />}
    </group>
  );
}