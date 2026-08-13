/**
 * LOD (Level of Detail) system for planet meshes
 * Switches between high-detail GLB models and low-poly fallback spheres based on camera distance
 */

import { useRef, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type LODLevel = "high" | "low" | "culled";

type LODConfig = {
  /** Distance threshold to switch from high-detail to low-detail (scene units) */
  highDetailDistance: number;
  /** Distance threshold to completely cull the object (stop rendering) */
  cullDistance: number;
  /** Enable LOD system (can be disabled for debugging) */
  enabled: boolean;
};

export const DEFAULT_LOD_CONFIG: LODConfig = {
  highDetailDistance: 80,
  cullDistance: 300,
  enabled: true,
};

type LODManagerProps = {
  position: THREE.Vector3;
  radius: number;
  config?: Partial<LODConfig>;
  onLODChange?: (level: LODLevel) => void;
  children: (lodLevel: LODLevel) => React.ReactNode;
};

/**
 * LODManager component
 * 
 * Monitors camera distance and switches LOD levels:
 * - HIGH: Camera close, render full GLB model
 * - LOW: Camera medium distance, render simple sphere
 * - CULLED: Camera far away, don't render at all (frustum culling)
 */
export function LODManager({ position, radius, config, onLODChange, children }: LODManagerProps) {
  const camera = useThree((state) => state.camera);
  const [lodLevel, setLODLevel] = useState<LODLevel>("high");
  const groupRef = useRef<THREE.Group>(null);

  const finalConfig: LODConfig = { ...DEFAULT_LOD_CONFIG, ...config };

  useFrame(() => {
    if (!finalConfig.enabled || !groupRef.current) {
      if (lodLevel !== "high") {
        setLODLevel("high");
        onLODChange?.("high");
      }
      return;
    }

    // Calculate distance from camera to object center
    const distance = camera.position.distanceTo(position);

    // Adjust distance thresholds based on object size (larger objects visible from farther away)
    const sizeMultiplier = Math.max(1, radius / 2);
    const adjustedHighDetail = finalConfig.highDetailDistance * sizeMultiplier;
    const adjustedCull = finalConfig.cullDistance * sizeMultiplier;

    let newLevel: LODLevel;
    if (distance > adjustedCull) {
      newLevel = "culled";
    } else if (distance > adjustedHighDetail) {
      newLevel = "low";
    } else {
      newLevel = "high";
    }

    if (newLevel !== lodLevel) {
      setLODLevel(newLevel);
      onLODChange?.(newLevel);
    }
  });

  return children(lodLevel);
}

/**
 * Simple hook to get current LOD level based on distance
 * Useful for components that need to know LOD state without wrapping in LODManager
 */
export function useLODLevel(position: THREE.Vector3, radius: number, config?: Partial<LODConfig>): LODLevel {
  const camera = useThree((state) => state.camera);
  const [lodLevel, setLODLevel] = useState<LODLevel>("high");

  const finalConfig: LODConfig = { ...DEFAULT_LOD_CONFIG, ...config };

  useFrame(() => {
    if (!finalConfig.enabled) {
      if (lodLevel !== "high") setLODLevel("high");
      return;
    }

    const distance = camera.position.distanceTo(position);
    const sizeMultiplier = Math.max(1, radius / 2);
    const adjustedHighDetail = finalConfig.highDetailDistance * sizeMultiplier;
    const adjustedCull = finalConfig.cullDistance * sizeMultiplier;

    let newLevel: LODLevel;
    if (distance > adjustedCull) {
      newLevel = "culled";
    } else if (distance > adjustedHighDetail) {
      newLevel = "low";
    } else {
      newLevel = "high";
    }

    if (newLevel !== lodLevel) setLODLevel(newLevel);
  });

  return lodLevel;
}

/**
 * Ref-based variant of useLODLevel — the position lives in a mutable ref
 * updated from useFrame, so updating it never triggers a React re-render.
 * Only crossing a distance threshold calls setState (no per-frame render
 * storm), which keeps React.memo'd scene components actually memoized.
 */
export function useLODRef(
  positionRef: React.MutableRefObject<THREE.Vector3>,
  radius: number,
  config?: Partial<LODConfig>,
): LODLevel {
  const camera = useThree((state) => state.camera);
  const [lodLevel, setLODLevel] = useState<LODLevel>("high");

  const finalConfig: LODConfig = { ...DEFAULT_LOD_CONFIG, ...config };

  useFrame(() => {
    if (!finalConfig.enabled) {
      if (lodLevel !== "high") setLODLevel("high");
      return;
    }

    const distance = camera.position.distanceTo(positionRef.current);
    const sizeMultiplier = Math.max(1, radius / 2);
    const adjustedHighDetail = finalConfig.highDetailDistance * sizeMultiplier;
    const adjustedCull = finalConfig.cullDistance * sizeMultiplier;

    let newLevel: LODLevel;
    if (distance > adjustedCull) {
      newLevel = "culled";
    } else if (distance > adjustedHighDetail) {
      newLevel = "low";
    } else {
      newLevel = "high";
    }

    if (newLevel !== lodLevel) setLODLevel(newLevel);
  });

  return lodLevel;
}

/**
 * Helper to determine if mobile device should use aggressive LOD
 */
export function shouldUseAggressiveLOD(): boolean {
  if (typeof window === 'undefined') return false;
  
  const dpr = window.devicePixelRatio || 1;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isLowEndDevice = dpr < 2;
  
  return isMobile || isLowEndDevice;
}

/**
 * Get LOD config adjusted for device capabilities
 */
export function getDeviceAdjustedLODConfig(): LODConfig {
  const isAggressive = shouldUseAggressiveLOD();
  
  return {
    ...DEFAULT_LOD_CONFIG,
    // Mobile devices switch to low-detail sooner
    highDetailDistance: isAggressive ? 50 : 80,
    cullDistance: isAggressive ? 200 : 300,
    enabled: true,
  };
}
