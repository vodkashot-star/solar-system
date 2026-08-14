import { Canvas } from "@react-three/fiber";
import { createXRStore, XR } from "@react-three/xr";
import { useSyncExternalStore, type ReactNode } from "react";

/**
 * Single shared XR store for both AR routes. Entry is driven by our own
 * "Enter AR" button (offerSession: false) and the Meta Quest emulator is
 * disabled so desktop dev renders the plain 3D preview.
 */
export const xrStore = createXRStore({ offerSession: false, emulate: false });

/** True while an immersive-ar session is live — subscribes to the store outside the Canvas. */
export function usePresenting(): boolean {
  return useSyncExternalStore(
    (cb) => xrStore.subscribe(cb),
    () => xrStore.getState().mode === "immersive-ar",
    () => false,
  );
}

/**
 * AR Canvas — runs with frameloop="always" because the WebXR pipeline hooks
 * R3F's useFrame loop and "demand" would freeze the session.
 */
export function ARCanvas({ children }: { children: ReactNode }) {
  return (
    <Canvas
      frameloop="always"
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 70, near: 0.01, far: 100 }}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <XR store={xrStore}>{children}</XR>
    </Canvas>
  );
}