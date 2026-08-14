import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useXR, useXRHitTest, PointerEvents } from "@react-three/xr";
import { useAR } from "@/stores/ar";
import { OrrerySystem } from "./OrrerySystem";
import { ARFocusBody } from "./ARFocusBody";

const RETICLE_RADIUS = 0.05;
const ROT_Y = new THREE.Matrix4();

function Reticle({ onPlace }: { onPlace: (matrix: THREE.Matrix4) => void }) {
  const hitMatrix = useRef(new THREE.Matrix4());

  useXRHitTest(
    (results, getWorldMatrix) => {
      const hit = results[0];
      if (!hit) return;
      getWorldMatrix(hitMatrix.current, hit);
    },
    "viewer",
  );

  useFrame((_, dt) => {
    ROT_Y.makeRotationY(dt * 0.5);
    hitMatrix.current.multiply(ROT_Y);
  });

  return (
    <group matrix={hitMatrix.current} matrixAutoUpdate={false}>
      {/* Large invisible click target — any tap places at the reticle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} onClick={() => onPlace(hitMatrix.current.clone())}>
        <circleGeometry args={[0.35, 32]} />
        <meshBasicMaterial transparent opacity={0.01} depthWrite={false} color="#000000" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[RETICLE_RADIUS * 0.8, RETICLE_RADIUS, 32]} />
        <meshBasicMaterial color="#7cc7ff" transparent opacity={0.95} side={THREE.DoubleSide} depthTest={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[RETICLE_RADIUS * 0.8, 32]} />
        <meshBasicMaterial color="#7cc7ff" transparent opacity={0.15} depthWrite={false} depthTest={false} />
      </mesh>
    </group>
  );
}

function GroundShadow({ radius }: { radius: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.0015, 0]}>
      <circleGeometry args={[radius, 48]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.38} depthWrite={false} />
    </mesh>
  );
}

/**
 * AR scene root — hit-test reticle → tap to anchor, then the system renders at
 * the anchored pose. Outside an active session it shows a plain 3D preview so
 * the AR page never feels empty.
 */
export function ARScene({ mode, bodyId }: { mode: "orrery" | "focus"; bodyId?: string }) {
  const presenting = useXR((s) => s.mode === "immersive-ar");
  const { placed, setPlaced, scale } = useAR();
  const [anchor, setAnchor] = useState<THREE.Matrix4 | null>(null);

  const previewAnchor = new THREE.Matrix4().makeTranslation(0, -0.28, -0.85);

  const anchorMatrix = presenting && anchor ? anchor : previewAnchor;

  return (
    <>
      {/* Forwards DOM pointer events (screen input) to scene objects */}
      <PointerEvents />
      <ambientLight intensity={0.7} />
      <directionalLight position={[1, 2.5, 1]} intensity={1.4} color="#fff6e6" />
      <pointLight position={[0, 0.5, 0]} intensity={0.4} color="#7cc7ff" />

      {presenting && !placed && (
        <Reticle onPlace={(m) => { setAnchor(m); setPlaced(true); }} />
      )}

      <group matrix={anchorMatrix} matrixAutoUpdate={false}>
        <GroundShadow radius={scale === "large" ? 1.15 : 0.34} />
        {mode === "orrery" ? <OrrerySystem /> : <ARFocusBody bodyId={bodyId ?? "earth"} />}
      </group>
    </>
  );
}