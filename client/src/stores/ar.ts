import { create } from "zustand";

export type ARScaleMode = "table" | "large";

type ARState = {
  /** Whether the system has been anchored to a surface (reticle tap) */
  placed: boolean;
  setPlaced: (placed: boolean) => void;
  /** Orrery footprint: table (~0.5 m system) or large (~2 m system) */
  scale: ARScaleMode;
  setScale: (scale: ARScaleMode) => void;
  /** Orrery motion multiplier (0 = paused) */
  speed: number;
  setSpeed: (speed: number) => void;
};

/** Shared AR session state (used by ARScene and the ARControls overlay) */
export const useAR = create<ARState>((set) => ({
  placed: false,
  setPlaced: (placed) => set({ placed }),
  scale: "table",
  setScale: (scale) => set({ scale }),
  speed: 1,
  setSpeed: (speed) => set({ speed }),
}));